import assert from "node:assert/strict";
import { DEFAULT_GATEWAY_OPTIONS } from "../../../src/config/gateway/gateway-options.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../../src/config/limits/limits-options.ts";

export async function checkWireBoundaries({ path, connections, alpha, slowWorker, raw, until, counters, held }) {
  // Reentrant snapshot-before-live handoff on a worker-scoped subscription, and
  // host event frames tagged with the routing identity they belong to.
  const peer = await raw(path); connections.push(peer.socket);
  peer.send({ v: 1, id: 1, method: "subscribe", params: { sessionId: "w-alpha" } });
  await until(() => peer.frames.length >= 2, "reentrant handoff");
  assert.equal(peer.frames[0].id, 1);
  assert.equal(peer.frames[0].result.sessionId, "w-alpha");
  assert.equal(peer.frames[1].v, 1);
  assert.equal(peer.frames[1].sessionId, "w-alpha", "host event frames carry their routing identity");
  assert.equal(peer.frames[1].event.sequence, peer.frames[0].result.sequence + 1);
  assert.equal(peer.frames[1].event.streamId, peer.frames[0].result.streamId);

  // One representative per envelope error category; none may reach the host.
  const callsBefore = counters.calls, lookupsBefore = counters.lookups;
  const rejected = [
    { v: 1, id: 1, method: "reload", params: { sessionId: "w-alpha" } },
    { v: 1, id: 2, method: "invented", params: {} },
    { v: 1, id: 4, method: "state", params: { sessionId: "w-alpha", unknown: true } },
    { v: 1, id: 5, method: "createSession", params: { kernelName: "python3" } },
    { v: 1, id: 6, method: "state", params: { worker: "w-alpha" } },
    { v: 1, id: 7, method: "state", params: { sessionId: "w-alpha", worker: "w-alpha" } },
    { v: 1, id: 8, method: "createWorker", params: { target: "shared" } },
    { v: 1, id: 9, method: "subscribeWorkers", params: {} },
  ];
  for (const request of rejected) peer.send(request);
  await until(() => peer.frames.length === 2 + rejected.length, "validation replies");
  assert(peer.frames.slice(2).every((frame) => !frame.ok));
  assert.deepEqual(peer.frames.slice(2).map((frame) => frame.error.code),
    ["DUPLICATE_ID", "UNSUPPORTED_METHOD", "INVALID_REQUEST", "INVALID_REQUEST", "INVALID_REQUEST", "INVALID_REQUEST", "UNSUPPORTED_METHOD", "UNSUPPORTED_METHOD"]);
  assert.equal(counters.calls, callsBefore, "Rejected envelopes never reach a host operation");
  assert.equal(counters.lookups, lookupsBefore, "Rejected envelopes never resolve a routing identity");

  // Unknown routing identities and unconfigured targets fail explicitly and do
  // no work; a refused subscribe must not release the live subscription slot.
  const unknownBefore = counters.calls;
  const unknown = [
    { v: 1, id: 12, method: "subscribe", params: { sessionId: "missing-identity" } },
  ];
  for (const request of unknown) peer.send(request);
  await until(() => peer.frames.length === 2 + rejected.length + unknown.length, "NOT_FOUND replies");
  assert.deepEqual(peer.frames.slice(2 + rejected.length).map((frame) => frame.error.code), Array(unknown.length).fill("NOT_FOUND"));
  assert.equal(counters.calls, unknownBefore, "Unknown identities and targets start no work and create nothing");
  alpha.deliver("state_changed");
  await until(() => peer.frames.length === 2 + rejected.length + unknown.length + 1, "subscription survives a refused subscribe");
  assert.equal(peer.frames.at(-1).sessionId, "w-alpha");

  // An unexpected host exception becomes a generic, secret-free HOST_ERROR.
  peer.send({ v: 1, id: 15, method: "closeSession", params: { sessionId: "w-boom" } });
  await until(() => peer.frames.at(-1).id === 15, "host exception reply");
  assert.equal(peer.frames.at(-1).error.code, "HOST_ERROR");
  assert(!JSON.stringify(peer.frames.at(-1)).includes("secret"));

  // subscribeSessions answers with the authoritative workbench snapshot and then
  // streams {v:1,collection} lifecycle frames on the same connection.
  const collector = await raw(path); connections.push(collector.socket);
  collector.send({ v: 1, id: 1, method: "subscribeSessions", params: {} });
  await until(() => collector.frames.length >= 1, "workbench snapshot");
  assert.equal(collector.frames[0].ok, true);
  assert.deepEqual(collector.frames[0].result.targets.map(({ id }) => id), ["shared", "other"]);
  assert(collector.frames[0].result.sessions.some(({ sessionId }) => sessionId === "w-alpha"));
  collector.send({ v: 1, id: 3, method: "createSession", params: { target: "shared" } });
  await until(() => collector.frames.filter((frame) => "collection" in frame).length >= 1, "collection lifecycle frame");
  const createdReply = collector.frames.find((frame) => frame.id === 3);
  assert.equal(createdReply.ok, true);
  assert.equal(createdReply.result.session.target, "shared");
  assert.equal(createdReply.result.session.cwd, "/work");
  assert(createdReply.result.snapshot.sessionId);

  // gateway.pendingMax backpressure answers BUSY without dropping admitted work.
  const before = counters.calls;
  for (let id = 16; id < 16 + DEFAULT_GATEWAY_OPTIONS.pendingMax + 1; id++) peer.send({ v: 1, id, method: "send", params: { sessionId: "w-alpha", requestId: `p${id}`, message: "held" } });
  await until(() => peer.frames.some((frame) => frame.error?.code === "BUSY"), "backpressure");
  assert.equal(counters.calls - before, DEFAULT_GATEWAY_OPTIONS.pendingMax);
  held.resolve();

  const malformed = await raw(path); connections.push(malformed.socket);
  malformed.socket.write('{"bad":'); malformed.socket.write("\n");
  await until(() => malformed.socket.destroyed, "malformed frame"); assert.equal(malformed.frames[0].error.code, "INVALID_REQUEST");

  const utf8 = await raw(path); connections.push(utf8.socket);
  const frame = Buffer.from(JSON.stringify({ v: 1, id: 1, method: "send", params: { sessionId: "w-alpha", requestId: "unicode", message: "界" } }) + "\n");
  const split = frame.indexOf(Buffer.from("界")) + 1;
  utf8.socket.write(frame.subarray(0, split)); utf8.socket.write(frame.subarray(split));
  await until(() => utf8.frames.length, "utf8 framing"); assert.equal(utf8.frames[0].ok, true);

  const oversized = await raw(path); connections.push(oversized.socket);
  const sizeBefore = counters.calls;
  oversized.socket.write(Buffer.alloc(DEFAULT_LIMITS_OPTIONS.inputBytes / 2, 32)); oversized.socket.write(Buffer.alloc(DEFAULT_LIMITS_OPTIONS.inputBytes / 2 + 1, 32));
  await until(() => oversized.socket.destroyed, "inbound limit"); assert.equal(oversized.frames[0].error.code, "TOO_LARGE"); assert.equal(counters.calls, sizeBefore);

  // A slow subscriber is dropped; losing an observer never closes the Gateway.
  const slow = await raw(path); connections.push(slow.socket);
  slow.send({ v: 1, id: 1, method: "subscribe", params: { sessionId: "w-slow" } });
  await until(() => slow.frames.length >= 2, "slow subscriber ready"); slow.socket.pause();
  const count = slowWorker.listeners.size;
  assert.equal(count, 1);
  for (let i = 0; i < 40; i++) slowWorker.deliver("message", { text: "x".repeat(500_000) });
  await until(() => slowWorker.listeners.size < count, "slow subscriber loss");
  assert.equal(counters.hostCloses, 0, "slow client loss must not close host");
  for (const socket of connections) socket.destroy();
}
