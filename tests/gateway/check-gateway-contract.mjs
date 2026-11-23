import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { chmod, lstat, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { WireError } from "../../src/gateway/wire/create-error.ts";

import { checkWireBoundaries } from "./contract/check-wire-boundaries.mjs";
import { checkClientSubscriptions } from "./contract/check-client-subscriptions.mjs";
import { createSession } from "./contract/create-session.mjs";
import { raw } from "./contract/open-raw-connection.mjs";
if (process.argv[2] === "--socket-child") {
  const gateway = await startGateway({
    workbench: () => ({ targets: [], sessions: [] }),
    subscribeSessions: () => () => {},
    close: async () => {},
  }, process.argv[3]);
  process.send("ready");
  await gateway.closed;
  process.disconnect();
  process.exit(0);
}

// Wire contract for the Gateway-owned worker collection. The host below is an
// in-process fake GatewaySessionHost (no SDK, no kernels); the sockets, framing,
// limits and routing are the real implementation.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, description = "Contract condition") {
  for (let i = 0; i < 400; i++) { if (await check()) return; await sleep(10); }
  throw new Error(`Timed out: ${description}`);
}

function launchSocketProcess(path) {
  const child = fork(fileURLToPath(import.meta.url), ["--socket-child", path], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-4000); });
  const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  }).finally(() => clearTimeout(timer));
  return {
    child, done,
    async ready() {
      const [message] = await Promise.race([once(child, "message"), done.then(() => { throw new Error(`Socket child exited before readiness: ${stderr}`); })]);
      assert.equal(message, "ready");
    },
  };
}

// calls counts host operations that actually do work; lookups counts routing
// resolutions. Rejected envelopes must move neither counter.
let calls = 0, lookups = 0, hostCloses = 0;
const held = Promise.withResolvers();
let submissionGate = held.promise;


const targets = Object.freeze([
  { id: "shared", label: "Shared instance", local: false, python: "/usr/bin/python3", cwd: "/work", tags: [] },
  { id: "other", label: "Other instance", local: false, python: "/usr/bin/python3", cwd: "/work", tags: [] },
]);
const sessions = new Map();
const collectionListeners = new Set();
const emitCollection = (type, worker) => {
  const event = { type, sessionId: worker, timestamp: new Date().toISOString() };
  for (const listener of [...collectionListeners]) listener(event);
};

const publicWorker = (worker) => ({
  label: worker.label ?? worker.sessionId,
  sessionId: worker.sessionId,
  state: "idle",
  ...(worker.target === undefined ? {} : { target: worker.target }),
  ...(worker.cwd === undefined ? {} : { cwd: worker.cwd }),
  ...(worker.model === undefined ? {} : { model: worker.model }),
  ...(worker.thinkingLevel === undefined ? {} : { thinkingLevel: worker.thinkingLevel }),
});
const seed = (name, target, cwd = "/work") => {
  const worker = createSession(name, target, cwd, () => { calls++; }, () => submissionGate);
  sessions.set(name, worker);
  return worker;
};

/** In-process GatewaySessionHost: the Gateway owns every session; clients observe. */
const gatewayHost = {
  workbench: () => ({ targets, sessions: [...sessions.values()].map(publicWorker) }),
  async createSession({ target, cwd }) {
    const configured = targets.find((entry) => entry.id === target);
    if (!configured) throw new WireError("NOT_FOUND", "Execution target is not configured; no worker was created.");
    calls++;
    const worker = seed(randomUUID(), target, cwd ?? configured.cwd);
    emitCollection("session_idle", worker.sessionId);
    return { session: publicWorker(worker), snapshot: worker.host.getSnapshot() };
  },
  state: (name) => gatewayHost.session(name).getSnapshot(),
  nativeSend(name, { sessionId: _worker, ...request }) {
    return gatewayHost.session(name).submit(request);
  },
  restoreSession: (identity) => Promise.reject(new WireError(
    "UNSUPPORTED_METHOD", `Explicit restoration of persisted worker ${JSON.stringify(identity.name)} is not implemented.`)),
  session(name) {
    lookups++;
    const worker = sessions.get(name);
    if (!worker) throw new WireError("NOT_FOUND", "Worker identity is not managed by this Gateway; no session was created.");
    return worker.host;
  },
  async closeSession(name) {
    const worker = sessions.get(name);
    if (!worker) throw new WireError("NOT_FOUND", "Worker identity is not managed by this Gateway; nothing was closed.");
    calls++;
    if (name === "w-boom") throw new Error("secret host exception must not escape");
    sessions.delete(name);
    emitCollection("session_closed", name);
  },
  subscribeSessions(listener) { collectionListeners.add(listener); return () => { collectionListeners.delete(listener); }; },
  close: async () => { hostCloses++; },
};

const root = await mkdtemp(join(tmpdir(), "pi-wire-"));
const path = join(root, "gateway.sock");
const directoryAlias = `${root}-alias`;
const alpha = seed("w-alpha", "shared");
const beta = seed("w-beta", "shared");
const slowWorker = seed("w-slow", "other");
const largeWorker = seed("w-large", "other");
seed("w-boom", "other");
const counters = { get calls() { return calls; }, get lookups() { return lookups; }, get hostCloses() { return hostCloses; } };
let gateway;
const connections = [];
const socketProcesses = [];
try {
  await chmod(root, 0o755);
  await symlink(root, directoryAlias);
  const tooLong = join(root, "x".repeat(101));
  await assert.rejects(startGateway(gatewayHost, tooLong), /at most 100 bytes/);
  await assert.rejects(connectGateway(tooLong), /at most 100 bytes/);
  await writeFile(path, "not a socket");
  await assert.rejects(startGateway(gatewayHost, path), /not a socket/);
  assert.equal(await readFile(path, "utf8"), "not a socket", "A non-socket path is preserved when startup is refused");
  await unlink(path);
  gateway = await startGateway(gatewayHost, join(directoryAlias, "gateway.sock"));
  const endpoint = await lstat(path);
  assert(endpoint.isSocket());
  assert.equal(endpoint.mode & 0o777, 0o777 & ~process.umask());
  await assert.rejects(startGateway(gatewayHost, path), /already running/);
  assert.equal((await lstat(path)).ino, endpoint.ino, "A live Gateway endpoint is never replaced");
  const endpointAlias = join(root, "alias.sock"); await symlink(path, endpointAlias);
  const aliased = await connectGateway(endpointAlias);
  try { assert.deepEqual((await aliased.request("workbench")).targets, targets); }
  finally { aliased.disconnect(); await unlink(endpointAlias); }
  await chmod(path, 0o666);
  const ordinary = await connectGateway(path);
  try { assert.deepEqual((await ordinary.request("workbench")).targets, targets); }
  finally { ordinary.disconnect(); }

  // Real processes leave a dead Unix socket after SIGKILL; startup reclaims it.
  // No SDK, model provider or kernel is created by these transport-only children.
  const restartPath = join(root, "nested", "gateway.sock");
  const firstProcess = launchSocketProcess(restartPath); socketProcesses.push(firstProcess);
  await firstProcess.ready();
  assert.equal((await lstat(join(root, "nested"))).mode & 0o777, 0o777 & ~process.umask());
  const firstClient = await connectGateway(restartPath);
  try { assert.deepEqual(await firstClient.request("workbench"), { targets: [], sessions: [] }); }
  finally { firstClient.disconnect(); }
  assert(firstProcess.child.kill("SIGKILL"));
  assert.deepEqual(await firstProcess.done, { code: null, signal: "SIGKILL" });
  assert((await lstat(restartPath)).isSocket(), "SIGKILL must leave the actual bound socket behind");
  await assert.rejects(connectGateway(restartPath), (error) => error.code === "CLIENT_ERROR");
  const secondProcess = launchSocketProcess(restartPath); socketProcesses.push(secondProcess);
  await secondProcess.ready();
  const restarted = await connectGateway(restartPath);
  try {
    assert.deepEqual(await restarted.request("workbench"), { targets: [], sessions: [] });
    await restarted.request("shutdown");
    assert.deepEqual(await secondProcess.done, { code: 0, signal: null });
  } finally { restarted.disconnect(); }
  await assert.rejects(lstat(restartPath), (error) => error.code === "ENOENT");

  await checkWireBoundaries({ path, connections, alpha, slowWorker, raw, until, counters, held });

  await checkClientSubscriptions({ path, connections, alpha, beta, largeWorker, raw, until, counters, held, sleep,
    setSubmissionGate: (value) => { submissionGate = value; } });

  await gateway.close();
  await assert.rejects(lstat(path), (error) => error.code === "ENOENT");
  assert.equal(hostCloses, 1);
  gateway = await startGateway({ ...gatewayHost, close: async () => { hostCloses++; throw new Error("secret shutdown failure"); } }, path);
  const failing = await connectGateway(path);
  try {
    await assert.rejects(failing.request("shutdown"), (error) => error.code === "HOST_ERROR" && !error.message.includes("secret"));
    await assert.rejects(gateway.closed, /shutdown failed/);
    await assert.rejects(lstat(path), (error) => error.code === "ENOENT");
    assert.equal(hostCloses, 2);
  } finally { failing.disconnect(); gateway = undefined; }
  console.log("PASS: default directory/socket modes, symlink aliases, live endpoint protection and real SIGKILL stale-socket restart, worker-scoped reentrant snapshot-first handoff with tagged event frames, malformed/unsupported/duplicate/blank-worker rejection without touching the host, NOT_FOUND for unknown identities and unconfigured targets, workbench snapshot plus {v:1,collection} lifecycle frames, independent host/collection slots on one connection, UTF-8 byte framing, inbound/outbound/backpressure limits, secret-safe errors, owned listener cleanup and failing shutdown");
} finally {
  held.resolve(); for (const socket of connections) socket.destroy();
  for (const run of socketProcesses) {
    if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill("SIGKILL");
    await run.done;
  }
  await gateway?.close(); await unlink(directoryAlias).catch((error) => { if (error.code !== "ENOENT") throw error; });
  await rm(root, { recursive: true, force: true });
}
