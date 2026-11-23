import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { WireError } from "../../src/gateway/wire/create-error.ts";
import { startWebServer } from "../../src/http/listener/start-listener.ts";
import { checkRouteOnlyHistory } from "./history-protocol/check-route-only-history.mjs";
import { rawGateway } from "./history-protocol/open-raw-gateway.mjs";

const root = await mkdtemp(join(tmpdir(), "history-protocol-"));
const socketPath = join(root, "gateway.sock");
const records = new Map([
  ["running", { target: "alpha", label: "Running", state: "running", history: true, sessionId: "running", cwd: "/work" }],
  ["archived", { target: "alpha", label: "Archived", state: "closed", history: true, sessionId: "archived", cwd: "/work" }],
]);
let historyCalls = 0;
let workerLookups = 0;
let renameCalls = 0;
let archiveCalls = 0;

const counters = () => ({ historyCalls, workerLookups, renameCalls, archiveCalls });
const publicSnapshot = (record) => ({ ...record });
const hostSnapshot = (record) => ({
  streamId: `history-${record.sessionId}`,
  sessionId: record.sessionId,
  sequence: 0,
  state: record.state === "running" ? "running" : "closed",
  messages: [],
  recentOperations: [],
  cwd: record.cwd,
});
const sessionHost = (record) => ({
  sessionId: record.sessionId,
  getSnapshot: () => hostSnapshot(record),
  subscribe: () => ({ snapshot: hostSnapshot(record), unsubscribe: () => {} }),
  submit: async () => ({ accepted: false, requestId: "unused", error: "history fixture" }),
  cancel: async () => ({ operationId: "unused", status: "not_found" }),
  reload: async () => {},
  close: async () => {},
});
const historyValue = (name) => {
  const record = records.get(name);
  if (!record) throw new WireError("NOT_FOUND", "Worker history was not found.");
  return {
    session: publicSnapshot(record),
    snapshot: { ...hostSnapshot(record), state: "closed" },
    readOnly: true,
  };
};
const host = {
  workbench: () => ({ targets: [{ id: "alpha", label: "Alpha instance", tags: [] }], sessions: [...records.values()].map(publicSnapshot) }),
  createSession: async () => { throw new WireError("UNSUPPORTED_METHOD", "not used"); },
  restoreSession: async () => { throw new WireError("UNSUPPORTED_METHOD", "not used"); },
  session(name) {
    workerLookups += 1;
    const record = records.get(name);
    if (!record) throw new WireError("NOT_FOUND", "Worker was not found.");
    return sessionHost(record);
  },
  history(name) {
    historyCalls += 1;
    return historyValue(name);
  },
  async renameSession(name, label) {
    const record = records.get(name);
    if (!record) throw new WireError("NOT_FOUND", "Worker was not found.");
    renameCalls += 1;
    record.label = label.trim();
    return publicSnapshot(record);
  },
  async archiveSession(name, request) {
    if (request.confirm !== true) throw new WireError("INVALID_REQUEST", "Literal confirmation is required.");
    const record = records.get(name);
    if (!record) throw new WireError("NOT_FOUND", "Worker history was not found.");
    if (record.state === "running") throw new WireError("BUSY", "Starting workers cannot be archived.");
    archiveCalls += 1;
    records.delete(name);
  },
  closeSession: async (name) => {
    const record = records.get(name);
    if (!record) throw new WireError("NOT_FOUND", "Worker was not found.");
    record.state = "closed";
    record.history = true;
  },
  subscribeSessions: () => () => {},
  close: async () => {},
};


async function closeSocket(socket) {
  if (!socket || socket.destroyed) return;
  await new Promise((resolve) => {
    socket.once("close", resolve);
    socket.destroy();
  });
}

async function cleanupOwned({ web, client, gateway, socket, root: ownedRoot }) {
  const failures = [];
  try { await web?.close(); } catch (error) { failures.push(error); }
  try { await closeSocket(socket); } catch (error) { failures.push(error); }
  try { client?.disconnect(); } catch (error) { failures.push(error); }
  try { await gateway?.close(); } catch (error) { failures.push(error); }
  try { await rm(ownedRoot, { recursive: true, force: true }); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, "History protocol cleanup failed.");
}



let gateway;
let client;
let web;
let nativeRaw;
try {
  gateway = await startGateway(host, socketPath);
  client = await connectGateway(socketPath);
  const webGateway = {
    available: () => true,
    call: (method, params) => client.request(method, params),
    observe: async () => () => {},
    close: async () => {},
  };
  web = await startWebServer(webGateway, { port: 0 });
  const origin = web.url;
  nativeRaw = await rawGateway(socketPath);

  const expectedHistory = historyValue("running");
  nativeRaw.send({ v: 1, id: 1, method: "history", params: { sessionId: "running" } });
  await nativeRaw.waitForFrames(1, "native history response");
  assert.deepEqual(nativeRaw.frames[0].result, expectedHistory, "Native history result is unchanged");
  assert.equal(nativeRaw.frames[0].result.snapshot.state, "closed");
  assert.equal(nativeRaw.frames[0].result.session.state, "running");
  assert.equal(nativeRaw.frames[0].result.readOnly, true);
  assert.equal(workerLookups, 0, "History does not resolve a live host or allocate a worker");

  const invalidIds = ["with/slash"];
  const invalidRequests = invalidIds.flatMap((worker, index) => [
    { v: 1, id: 2 + index * 3, method: "history", params: { sessionId: worker } },
    { v: 1, id: 3 + index * 3, method: "renameSession", params: { sessionId: worker, label: "valid" } },
    { v: 1, id: 4 + index * 3, method: "archiveSession", params: { sessionId: worker, confirm: true } },
  ]);
  const beforeInvalid = counters();
  for (const request of invalidRequests) nativeRaw.send(request);
  await nativeRaw.waitForFrames(invalidRequests.length + 1, "native invalid history routing validation");
  assert(nativeRaw.frames.slice(1).every((frame) => frame.ok === false && frame.error.code === "INVALID_REQUEST"));
  assert.deepEqual(counters(), beforeInvalid, "Invalid new-method routing identifiers never reach the host");

  await assert.rejects(client.request("archiveSession", { sessionId: "running", confirm: true }), (error) => error.code === "BUSY");
  assert.equal(archiveCalls, 0, "A BUSY session is not archived");
  assert.deepEqual(await client.request("renameSession", { sessionId: "running", label: "  Renamed  " }), { ...records.get("running"), label: "Renamed" });
  assert.equal(renameCalls, 1);
  assert.deepEqual(await client.request("archiveSession", { sessionId: "archived", confirm: true }), { ok: true });
  assert.equal(archiveCalls, 1);

  const request = (path, options = {}) => new Promise((resolve, reject) => {
    const body = options.body;
    const outgoing = httpRequest(`${origin}${path}`, {
      method: options.method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(options.origin === false ? {} : { Origin: origin }),
        ...options.headers,
      },
      signal: AbortSignal.timeout(10_000),
    }, (incoming) => {
      let value = "";
      incoming.setEncoding("utf8");
      incoming.on("data", (chunk) => { value += chunk; });
      incoming.once("end", () => resolve({ status: incoming.statusCode ?? 0, body: value }));
    });
    outgoing.once("error", reject);
    outgoing.end(body);
  });

  let response = await request("/api/sessions/running/history");
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), historyValue("running"), "HTTP history shape is untouched");

  const beforeHttpInvalid = counters();
  assert([400, 404].includes((await request("/api/sessions/%2F/history")).status));
  assert.deepEqual(counters(), beforeHttpInvalid, "Malformed HTTP routing identifiers never reach the host");

  response = await request("/api/sessions/running/rename", { body: JSON.stringify({ label: "ok", extra: true }) });
  assert.equal(response.status, 400);
  response = await request("/api/sessions/running/rename", { body: JSON.stringify({ label: "  Browser label  " }) });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).label, "Browser label");

  response = await request("/api/sessions/running/archive", { body: JSON.stringify({ confirm: false }) });
  assert.equal(response.status, 400);
  response = await request("/api/sessions/running/archive", { body: JSON.stringify({ confirm: true }) });
  assert.equal(response.status, 409, "Running BUSY maps to HTTP 409");

  response = await request("/api/sessions/archived/history");
  assert.equal(response.status, 404);
  response = await request("/api/sessions/running/history", { headers: { Origin: "https://attacker.invalid" } });
  assert.equal(response.status, 403);
  response = await request("/api/sessions/running/rename", { body: JSON.stringify({ label: "No origin" }), origin: false });
  assert.equal(response.status, 403);
  response = await request("/api/sessions/running/history", { method: "POST", body: "{}" });
  assert.equal(response.status, 405);

  await checkRouteOnlyHistory();
  console.log("PASS history protocol: wire routing validation, read-only exact SDK history, confirmation and BUSY mapping, and browser origin gates");
} finally {
  await cleanupOwned({ web, client, gateway, socket: nativeRaw?.socket, root });
}
