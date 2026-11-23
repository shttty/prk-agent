// Terminal WebSocket adapter against a scripted Gateway client (no Jupyter, no browser): connect-time waiting for a
// transient session transition with a bounded backoff, immediate failure for everything else, frame routing, close codes.
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { DEFAULT_HTTP_OPTIONS } from "../../src/config/http/http-options.ts";
import { WireError } from "../../src/gateway/wire/create-error.ts";
import { startWebServer } from "../../src/http/listener/start-listener.ts";

const http = { ...DEFAULT_HTTP_OPTIONS, terminalBusyRetriesMax: 3, terminalBusyBackoffMs: 5, terminalBusyBackoffMaxMs: 20 };
const transientBusy = () => new WireError("BUSY", "Session is changing; retry once it settles.", { transient: true });
const waitFor = async (predicate, label) => {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

let script = [];   // outcomes for successive terminalSession calls: an Error to throw, or "ok"
let attempts = 0;
let live;          // { sink, input: [], resize: [], closed }
const gateway = {
  available: () => true,
  async terminalSession(worker, name, sink) {
    attempts += 1;
    const outcome = script.shift() ?? "ok";
    if (outcome !== "ok") throw outcome;
    live = { sessionId: worker, name, sink, input: [], resize: [], closed: 0 };
    sink.snapshot({ name, connectionStatus: "connected", replay: "$ " });
    return { input: (data) => live.input.push(data), resize: (rows, cols) => live.resize.push([rows, cols]), close: () => { live.closed += 1; } };
  },
};
const web = await startWebServer(gateway, { port: 0, http });
const url = (worker = "w", name = "shell") => `${web.url.replace("http:", "ws:")}/api/sessions/${worker}/terminals/${name}/ws`;
function open(headers = { Origin: web.url }, target = url()) {
  const ws = new WebSocket(target, { headers });
  const socket = { ws, frames: [], code: undefined };
  socket.closed = new Promise((resolve) => ws.on("close", (code) => { socket.code = code; resolve(); }));
  ws.on("message", (raw) => socket.frames.push(JSON.parse(raw.toString())));
  ws.on("error", () => {});
  return socket;
}

try {
  // waits out a transient BUSY, then attaches; the browser sees no error
  script = [transientBusy(), transientBusy(), transientBusy()];
  attempts = 0;
  const waited = open();
  await waitFor(() => waited.frames.some((frame) => frame.type === "snapshot"), "attach after transient BUSY");
  assert.equal(attempts, 4, "Three transient refusals, then the attach");
  assert(!waited.frames.some((frame) => frame.type === "error"), "Waiting shows nothing");
  assert.deepEqual([live.sessionId, live.name], ["w", "shell"]);

  // frames: input and resize reach the session in order; stdout and ping go back
  for (const data of ["a", "b", "c"]) waited.ws.send(JSON.stringify({ type: "input", data }));
  waited.ws.send(JSON.stringify({ type: "resize", rows: 20, cols: 90 }));
  waited.ws.send(JSON.stringify({ type: "input", data: "d" }));
  waited.ws.send(JSON.stringify({ type: "ping" }));
  await waitFor(() => waited.frames.some((frame) => frame.type === "pong"), "pong");
  assert.deepEqual(live.input, ["a", "b", "c", "d"]);
  assert.deepEqual(live.resize, [[20, 90]]);
  live.sink.event({ type: "stdout", data: "out" });
  await waitFor(() => waited.frames.some((frame) => frame.type === "stdout" && frame.data === "out"), "stdout frame");
  live.sink.failure(new WireError("UNAVAILABLE", "Terminal is not connected; no input was sent or queued."));
  await waitFor(() => waited.frames.some((frame) => frame.type === "error" && frame.code === "UNAVAILABLE"), "input failure frame");
  assert.equal(waited.ws.readyState, WebSocket.OPEN, "A rejected keystroke does not end the socket");

  // malformed frame: closed with 1008
  waited.ws.send(JSON.stringify({ type: "input" }));
  await waited.closed;
  assert.equal(waited.code, 1008);
  await waitFor(() => live.closed === 1, "session released after the browser socket closed");

  // the Gateway connection ending under a live terminal: reconnectable close code
  const ended = open();
  await waitFor(() => ended.frames.some((frame) => frame.type === "snapshot"), "attach");
  live.sink.end("Gateway terminal connection ended.");
  await ended.closed;
  assert.notEqual(ended.code, 4000, "A dropped Gateway connection lets the browser reconnect");

  // the terminal ended: closed frame, then the final code
  const finished = open();
  await waitFor(() => finished.frames.some((frame) => frame.type === "snapshot"), "attach");
  live.sink.event({ type: "closed" });
  await finished.closed;
  assert.equal(finished.frames.at(-1).type, "closed");
  assert.equal(finished.code, 4000);

  // a persistent transient BUSY is waited out only up to the configured retries, then reported
  script = Array.from({ length: 10 }, transientBusy);
  attempts = 0;
  const exhausted = open();
  await exhausted.closed;
  assert.equal(attempts, http.terminalBusyRetriesMax + 1);
  assert.equal(exhausted.frames.find((frame) => frame.type === "error")?.code, "BUSY");
  assert.equal(exhausted.code, 4000);

  // anything else fails at once, with no retry
  for (const error of [new WireError("NOT_FOUND", "gone"), new WireError("BUSY", "Worker terminal limit reached."), new WireError("INVALID_REQUEST", "Worker is closed")]) {
    script = [error];
    attempts = 0;
    const refused = open();
    await refused.closed;
    assert.equal(attempts, 1, `${error.code} is not retried`);
    assert.equal(refused.frames.find((frame) => frame.type === "error")?.code, error.code);
    assert.equal(refused.code, 4000);
  }

  // the browser leaving while the Gateway is still busy stops the waiting
  script = Array.from({ length: 10 }, transientBusy);
  attempts = 0;
  const left = open();
  await waitFor(() => attempts >= 1, "first attempt");
  left.ws.terminate();
  await left.closed;
  const seen = attempts;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert(attempts <= seen + 1, "No further attempts once the browser is gone");

  // origin: a socket can type into a shell, so it needs the exact workbench Origin
  for (const headers of [{ Origin: "https://foreign.invalid" }, {}]) {
    const probe = new WebSocket(url(), { headers });
    assert.equal(await new Promise((resolve) => { probe.on("unexpected-response", (_request, response) => resolve(response.statusCode)); probe.on("error", () => {}); }), 403);
  }
  const unknown = new WebSocket(url("w", "shell").replace("/ws", "/nope"), { headers: { Origin: web.url } });
  assert.equal(await new Promise((resolve) => { unknown.on("unexpected-response", (_request, response) => resolve(response.statusCode)); unknown.on("error", () => {}); }), 404);
  console.log("PASS terminal socket: transient BUSY waited out within the configured retries, other failures immediate and final, ordered input/resize routing, close codes, session release, exact-Origin upgrade");
} finally {
  await web.close();
}
