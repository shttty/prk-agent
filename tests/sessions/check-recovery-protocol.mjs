import { DEFAULT_GATEWAY_OPTIONS } from "../../src/config/gateway/gateway-options.ts";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createConnection } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { WireError } from "../../src/gateway/wire/create-error.ts";
import { connectWebGateway } from "../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../src/http/listener/start-listener.ts";

const workerName = "worker-recovery";
const recoveryCalls = [];
const snapshot = (recovery) => ({
  target: "fixture",
  label: "Recovery fixture",
  cwd: "/work",
  sessionId: workerName,
  state: "idle",
  ...(recovery === undefined ? {} : { recovery }),
});
const hostSnapshot = () => ({
  streamId: "stream-session-recovery",
  sessionId: workerName,
  sequence: 0,
  state: "idle",
  messages: [],
  recentOperations: [],
});
const sessionHost = {
  sessionId: workerName,
  getSnapshot: hostSnapshot,
  subscribe() {
    return { snapshot: hostSnapshot(), unsubscribe() {} };
  },
  async submit() { return { accepted: false, requestId: "fixture", error: "not used" }; },
  async cancel() { return { operationId: "fixture", status: "not_found" }; },
  async reload() {},
  async close() {},
};
const gatewayHost = {
  workbench: () => ({ targets: [{ id: "fixture", label: "Fixture instance", local: true, python: "/usr/bin/python3", tags: [] }], sessions: [snapshot()] }),
  async createSession() { return { session: snapshot(), snapshot: hostSnapshot() }; },
  history: () => ({ readOnly: true, session: snapshot(), snapshot: hostSnapshot() }),
  async renameSession() { return snapshot(); },
  async recoverSession(name, { mode, ...selection }) {
    assert.equal(name, workerName);
    recoveryCalls.push({ name, mode, ...selection });
    const recovery = { status: "new", message: "A new REPL was created; Python variables were not retained." };
    return { session: snapshot(recovery), snapshot: hostSnapshot() };
  },
  session(name) {
    if (name !== workerName) throw new WireError("NOT_FOUND", "Unknown fixture worker.");
    return sessionHost;
  },
  async closeSession() {},
  subscribeSessions() { return () => {}; },
  async close() {},
};

async function rawRequest(path, value) {
  const socket = createConnection(path);
  await once(socket, "connect");
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString();
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      socket.removeListener("data", onData);
      socket.end();
      resolve(JSON.parse(buffer.slice(0, end)));
    };
    socket.once("error", reject);
    socket.on("data", onData);
    socket.write(`${JSON.stringify(value)}\n`);
  });
}


const root = await mkdtemp(join(tmpdir(), "pi-recovery-protocol-"));
const socketPath = join(root, "gateway.sock");
let gateway;
let nativeClient;
let webClient;
let webServer;
try {
  gateway = await startGateway(gatewayHost, socketPath);
  nativeClient = await connectGateway(socketPath);

  const callsBeforeInvalid = recoveryCalls.length;
  const malformed = await rawRequest(socketPath, {
    v: 1,
    id: 1,
    method: "recoverSession",
    params: { sessionId: workerName, mode: "reconnect", extra: true },
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.code, "INVALID_REQUEST");
  assert.equal(recoveryCalls.length, callsBeforeInvalid);

  const removed = await rawRequest(socketPath, { v: 1, id: 2, method: "recoverSession", params: { sessionId: workerName, mode: "reconnect" } });
  assert.equal(removed.error.code, "INVALID_REQUEST", "Removed reconnect mode is rejected without an alias");
  const nativeAutomatic = await nativeClient.request("recoverSession", { sessionId: workerName, mode: "auto" });
  assert.equal(nativeAutomatic.session.recovery.status, "new");
  webClient = await connectWebGateway({ socket: socketPath, gateway: { ...DEFAULT_GATEWAY_OPTIONS, connectTimeoutMs: 5_000, requestTimeoutMs: 5_000 } });

  webServer = await startWebServer(webClient, { host: "127.0.0.1", port: 0 });
  async function recover(body) {
    const response = await fetch(`${webServer.url}/api/sessions/${workerName}/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: webServer.url },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  const httpMoved = await recover({ mode: "new", target: "fixture", cwd: "/work/next" });
  assert.equal(httpMoved.status, 200);
  assert.deepEqual(recoveryCalls.at(-1), { name: workerName, mode: "new", target: "fixture", cwd: "/work/next" });
  assert.equal(httpMoved.body.snapshot.sessionId, workerName);
  const callsBeforeHttpInvalid = recoveryCalls.length;
  const httpInvalidMode = await recover({ mode: "invalid" });
  assert.equal(httpInvalidMode.status, 400);
  assert.equal((await recover({ mode: "new" })).status, 400);
  assert.equal((await recover({ mode: "new", target: "fixture", kernelName: "removed" })).status, 400);
  assert.equal(recoveryCalls.length, callsBeforeHttpInvalid);

  console.log("PASS: removed/malformed recovery rejected before dispatch; native auto and HTTP explicit target forward fresh-REPL status and session identity");
} finally {
  await webServer?.close();
  await webClient?.close();
  nativeClient?.disconnect();
  await gateway?.close();
  await rm(root, { recursive: true, force: true });
}
