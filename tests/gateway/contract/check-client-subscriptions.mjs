import assert from "node:assert/strict";
import { DEFAULT_GATEWAY_OPTIONS } from "../../../src/config/gateway/gateway-options.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../../src/config/limits/limits-options.ts";
import { connectGateway } from "../../../src/gateway/socket-client/connect-client.ts";
import { connectWebGateway } from "../../../src/http/gateway-connection/connect-gateway.ts";

export async function checkClientSubscriptions({ path, connections, alpha, beta, largeWorker, raw, until, counters, held, sleep, setSubmissionGate }) {
  // The client library delivers the snapshot Promise before same-chunk events.
  const client = await connectGateway(path);
  let snapshotDelivered = false;
  const clientEvents = [];
  client.onEvent((event, worker) => { assert(snapshotDelivered, "library must deliver snapshot Promise before same-chunk events"); clientEvents.push({ event, sessionId: worker }); });
  await client.request("subscribe", { sessionId: "w-alpha" }); snapshotDelivered = true;
  await until(() => clientEvents.length > 0, "client event delivery");
  assert.equal(clientEvents[0].sessionId, "w-alpha");
  const state = await client.request("state", { sessionId: "w-alpha" }); assert.equal(state.sessionId, "w-alpha"); client.disconnect();

  // One connection holds an independent host slot and collection slot.
  const both = await connectGateway(path);
  const hostFeed = [], collectionFeed = [];
  both.onEvent((event, worker) => hostFeed.push({ event, sessionId: worker }));
  both.onCollectionEvent((event) => collectionFeed.push(event));
  const workbench = await both.request("subscribeSessions");
  assert.deepEqual(workbench.targets.map(({ id }) => id), ["shared", "other"]);
  assert(workbench.sessions.some(({ sessionId }) => sessionId === "w-beta"));
  await both.request("subscribe", { sessionId: "w-beta" });
  const created = await both.request("createSession", { target: "shared" });
  await until(() => collectionFeed.some((event) => event.sessionId === created.session.sessionId), "collection slot delivery");
  beta.deliver("state_changed");
  await until(() => hostFeed.some(({ sessionId: worker }) => worker === "w-beta"), "host slot delivery");
  assert(hostFeed.every(({ sessionId: worker }) => worker === "w-beta"), "A host slot never carries another worker's events");

  // unsubscribe releases only the host slot.
  await both.request("unsubscribe");
  const hostCount = hostFeed.length, collectionCount = collectionFeed.length;
  beta.deliver("state_changed");
  await both.request("closeSession", { sessionId: created.session.sessionId });
  await until(() => collectionFeed.length > collectionCount, "collection slot stays live");
  await both.request("state", { sessionId: "w-beta" });
  assert.equal(hostFeed.length, hostCount, "unsubscribe releases only the host slot");

  // unsubscribeSessions releases only the collection slot.
  await both.request("subscribe", { sessionId: "w-beta" });
  await both.request("unsubscribeSessions");
  await until(() => hostFeed.length > hostCount, "host slot re-established");
  const hostAfter = hostFeed.length, collectionAfter = collectionFeed.length;
  await both.request("createSession", { target: "other" });
  beta.deliver("state_changed");
  await until(() => hostFeed.length > hostAfter, "host slot stays live");
  await both.request("state", { sessionId: "w-beta" });
  assert.equal(collectionFeed.length, collectionAfter, "unsubscribeSessions releases only the collection slot");
  both.disconnect();

  const webClient = await connectWebGateway({ socket: path });
  const observed = [];
  const rotating = await raw(path); connections.push(rotating.socket);
  try {
    await webClient.observe("w-beta", {
      snapshot: (snapshot) => observed.push({ type: "snapshot", snapshot }),
      event: (event) => observed.push({ type: "event", event }),
      end() {},
    });
    rotating.send({ v: 1, id: 1, method: "subscribe", params: { sessionId: "w-beta" } });
    await until(() => rotating.frames.length >= 2, "replacement observer subscribed");
    const previousStreamId = beta.host.getSnapshot().streamId;
    const replacement = beta.replaceStream();
    beta.deliver("message", { text: "replacement-first" });
    beta.deliver("message", { streamId: previousStreamId, sequence: 1000000, text: "retired-stream" });
    beta.deliver("message", { sequence: 0, text: "late-sequence" });
    beta.deliver("snapshot", { sequence: 0, details: { snapshot: { ...replacement, messages: [{ role: "user", content: "late-snapshot" }] } } });
    beta.deliver("message", { text: "replacement-last" });
    await until(() => observed.some((frame) => frame.event?.text === "replacement-last") && rotating.frames.some((frame) => frame.event?.text === "replacement-last"), "replacement low counters remain live");
    const replacementIndex = observed.findIndex((frame) => frame.event?.type === "snapshot" && frame.event.streamId === replacement.streamId);
    assert(replacementIndex >= 0, "the existing HTTP observer receives the replacement snapshot as a host event");
    assert.equal(observed[replacementIndex].event.details.snapshot.sequence, 0);
    assert.equal(observed[replacementIndex + 1].event.text, "replacement-first", "replacement snapshot precedes its first delta");
    assert.equal(observed[replacementIndex + 1].event.streamId, replacement.streamId);
    assert.deepEqual(observed.filter((frame) => frame.event?.type === "message").map((frame) => frame.event.text), ["replacement-first", "replacement-last"]);
    assert.deepEqual(rotating.frames.filter((frame) => frame.event?.type === "message").map((frame) => frame.event.text), ["replacement-first", "replacement-last"], "the socket drops foreign-stream and late-sequence deltas");
    assert(!JSON.stringify(observed).includes("late-snapshot"), "a delayed same-stream full snapshot cannot rewind its counter");
  } finally { rotating.socket.destroy(); await webClient.close(); }

  const timeoutGate = Promise.withResolvers(); setSubmissionGate(timeoutGate.promise);
  const timed = await connectGateway(path, { ...DEFAULT_GATEWAY_OPTIONS, connectTimeoutMs: 50, requestTimeoutMs: 50 }); const callCount = counters.calls;
  try {
    await assert.rejects(timed.request("send", { sessionId: "w-alpha", requestId: "unknown", message: "held" }), /outcome unknown/);
    await sleep(100); assert.equal(counters.calls, callCount + 1, "timed-out client must never replay"); assert.equal(counters.hostCloses, 0);
  } finally { timeoutGate.resolve(); timed.disconnect(); setSubmissionGate(held.promise); }
  await until(() => alpha.listeners.size === 0 && beta.listeners.size === 0, "subscriptions released on disconnect");

  const large = await connectGateway(path);
  largeWorker.setMessages([{ role: "user", content: "x".repeat(DEFAULT_LIMITS_OPTIONS.outputBytes) }]);
  try {
    await assert.rejects(large.request("subscribe", { sessionId: "w-large" }), /Result exceeds output limit/);
    assert.equal(largeWorker.listeners.size, 0, "failed snapshot must not leave a live subscription without a boundary");
  } finally { largeWorker.setMessages([]); large.disconnect(); }
}
