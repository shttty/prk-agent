import { DEFAULT_GATEWAY_OPTIONS } from "../../src/config/gateway/gateway-options.ts";
import { DEFAULT_HTTP_OPTIONS } from "../../src/config/http/http-options.ts";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { connectWebGateway } from "../../src/http/gateway-connection/connect-gateway.ts";

const waitFor = async (predicate, description, timeout = 5_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out: ${description}`);
};

const directory = await mkdtemp(join(tmpdir(), "web-gateway-client-check-"));
const socketPath = join(directory, "gateway.sock");
const active = new Set();
let accepted = 0;
const server = createServer((socket) => {
  accepted += 1;
  active.add(socket);
  socket.once("close", () => active.delete(socket));
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(socketPath, () => {
    server.removeListener("error", reject);
    resolve();
  });
});
await chmod(socketPath, 0o600);

const closeServer = async () => {
  for (const socket of active) socket.destroy();
  await new Promise((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
};

try {
  // Reservations happen before the first await: the second observation is
  // rejected even while the first Gateway socket is still connecting.
  let firstEnded = 0;
  const first = await connectWebGateway({ socket: socketPath, gateway: { ...DEFAULT_GATEWAY_OPTIONS, connectTimeoutMs: 5_000, requestTimeoutMs: 5_000 }, http: { ...DEFAULT_HTTP_OPTIONS, streamsMax: 1 } });
  assert.equal(accepted, 1, "The web client establishes one control connection");
  const firstObservation = first.observe("session-a", {
    snapshot: () => {},
    event: () => {},
    end: () => { firstEnded += 1; },
  });
  const rejectedByCap = first.observe("session-b", {
    snapshot: () => {},
    event: () => {},
    end: () => {},
  });
  await assert.rejects(rejectedByCap, (error) => error?.code === "BUSY", "Concurrent observations reserve the stream cap");
  await first.close();
  await assert.rejects(firstObservation, (error) => error?.code === "CLIENT_ERROR", "A pending observation fails when its web client closes");
  await waitFor(() => active.size === 0, "pending observation and control sockets to close after web shutdown");
  assert.equal(first.streamCount(), 0);
  assert.equal(firstEnded, 1, "A pending observation is ended exactly once");

  // A reconnect that is already in flight when close() runs must not become a
  // retained control socket after its async connection completes.
  const reconnecting = await connectWebGateway({ socket: socketPath, gateway: { ...DEFAULT_GATEWAY_OPTIONS, connectTimeoutMs: 5_000, requestTimeoutMs: 5_000 } });
  const control = [...active][0];
  assert(control, "The reconnect test has an active control socket");
  control.destroy();
  await waitFor(() => !reconnecting.available(), "control connection loss to become observable");
  const pendingCall = reconnecting.call("workbench", {});
  await reconnecting.close();
  await assert.rejects(pendingCall, (error) => error?.code === "CLIENT_ERROR", "A pending control reconnect fails after close");
  await waitFor(() => accepted >= 4, "the reconnect attempt to reach the socket server");
  await waitFor(() => active.size === 0, "a control reconnect that completes after close to be disconnected");
  assert.equal(reconnecting.streamCount(), 0);

  // Terminal input is pipelined on one ordered connection: requests go out without waiting for earlier replies, at most
  // pendingMax-1 are in flight, the rest queue in order with adjacent inputs merged, and nothing is lost or reordered.
  const terminalPath = join(directory, "terminal.sock");
  const requests = [];
  const unanswered = [];
  const terminalServer = createServer((socket) => {
    active.add(socket);
    socket.once("close", () => active.delete(socket));
    let buffered = "";
    socket.on("data", (chunk) => {
      buffered += chunk;
      for (let end = buffered.indexOf("\n"); end >= 0; end = buffered.indexOf("\n")) {
        const frame = JSON.parse(buffered.slice(0, end));
        buffered = buffered.slice(end + 1);
        if (frame.method === "terminalInput" || frame.method === "terminalResize") {
          requests.push(frame);
          unanswered.push({ socket, id: frame.id });
        } else {
          const result = frame.method === "subscribeTerminal" ? { name: "t", connectionStatus: "connected", replay: "" } : { name: "t" };
          socket.write(`${JSON.stringify({ v: 1, id: frame.id, ok: true, result })}\n`);
        }
      }
    });
  });
  await new Promise((resolve) => terminalServer.listen(terminalPath, resolve));
  await chmod(terminalPath, 0o600);
  try {
    const terminalClient = await connectWebGateway({ socket: terminalPath, gateway: { ...DEFAULT_GATEWAY_OPTIONS, pendingMax: 3, connectTimeoutMs: 5_000, requestTimeoutMs: 5_000 } });
    const failures = [];
    const session = await terminalClient.terminalSession("w", "t", { snapshot: () => {}, event: () => {}, end: () => {}, failure: (error) => failures.push(error.code) });
    for (const letter of "abcd") session.input(letter);
    session.resize(30, 100);
    session.input("e");
    await waitFor(() => requests.length === 2, "two inputs in flight before any reply");
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(requests.length, 2, "No more than pendingMax-1 requests are in flight");
    assert.deepEqual(requests.map((request) => request.params.data), ["a", "b"], "The first inputs left without waiting for replies");
    const answer = (ok) => {
      const { socket, id } = unanswered.shift();
      socket.write(`${JSON.stringify(ok ? { v: 1, id, ok: true, result: { sent: true } } : { v: 1, id, ok: false, error: { code: "UNAVAILABLE", message: "not connected" } })}\n`);
    };
    answer(true);
    await waitFor(() => requests.length === 3, "a queued request leaves when a reply frees a slot");
    answer(false);
    await waitFor(() => requests.length === 4, "the next queued request leaves");
    answer(true);
    await waitFor(() => requests.length === 5, "the last queued request leaves");
    assert.deepEqual(requests.map((request) => request.method === "terminalInput" ? request.params.data : `resize ${request.params.rows}x${request.params.cols}`),
      ["a", "b", "cd", "resize 30x100", "e"], "Order is kept, adjacent queued inputs are merged, the resize stays between them");
    await waitFor(() => failures.length === 1, "a rejected input is reported once");
    assert.deepEqual(failures, ["UNAVAILABLE"]);
    session.close();
  } finally {
    for (const socket of active) socket.destroy();
    await new Promise((resolve) => terminalServer.close(() => resolve()));
  }

  console.log("PASS web gateway client lifecycle: pending observation reservation, concurrent stream cap, close guards, post-close control reconnect cleanup, and ordered pipelined terminal input with bounded in-flight requests");
} finally {
  await closeServer();
}
