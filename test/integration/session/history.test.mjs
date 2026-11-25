import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { gatewayFixture, text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

test("Gateway pushes an anchored light observation and serves the prior page without overlap", async (t) => {
  const f = await gatewayFixture(t);
  await f.deploy();
  const id = await f.create();
  for (let i = 0; i < 51; i++) {
    assert.equal((await f.complete(id, await f.send(id, `Question ${i}`))).status, "completed");
  }
  const frames = [];
  f.client.onEvent((event) => frames.push(event));
  await f.request("subscribe", { sessionId: id });
  const receipt = await f.send(id, "Last question");
  assert.equal((await f.complete(id, receipt)).status, "completed");
  const pushed = await until(() => frames.find((event) => event.type === "snapshot"), "pushed light observation");
  const snap = pushed.details.snapshot;
  assert.equal(snap.state, "idle");
  for (const key of ["messages", "messageEntryIds"]) assert.equal(Object.hasOwn(snap, key), false);
  const latest = await f.request("historyPage", { sessionId: id, through: snap.historyThrough });
  assert.equal(latest.messages.length, 100);
  assert.equal(text(latest.messages.at(-2)), "Last question");
  const older = await f.request("historyPage", { sessionId: id, before: latest.historyBefore });
  assert.deepEqual(older.messages.filter((item) => item.role === "user").map(text), ["Question 0", "Question 1"]);
  assert.equal(older.historyBefore, null);
  assert(!older.messageEntryIds.some((item) => latest.messageEntryIds.includes(item)));
});

test("sleeping /compact wakes, acknowledges before the model, and persists a compaction marker", async (t) => {
  const f = await gatewayFixture(t, { config: { session: { workerTools: "direct", idleTimeoutMs: 1_000 } } });
  await f.deploy();
  const id = await f.create();
  for (let i = 0; i < 3; i++) {
    const receipt = await f.send(id, `Part ${i}: ${"historic context segment ".repeat(200)}`);
    assert.equal((await f.complete(id, receipt)).status, "completed");
  }
  let contextSeen;
  const release = Promise.withResolvers();
  f.provider.setResponses([async (context) => {
    contextSeen = context;
    await release.promise;
    return fauxAssistantMessage("Verification summary");
  }, fauxAssistantMessage("Verification turn prefix")]);
  const frames = [];
  f.client.onEvent((event) => frames.push(event));
  const awake = await f.request("subscribe", { sessionId: id });
  const sleeping = await until(async () => {
    const state = await f.request("state", { sessionId: id });
    return state.state === "sleeping" && state;
  }, "session sleep before native input");
  const catalog = await f.request("nativeCapabilities", { sessionId: id });
  assert.equal(catalog.commands.find((command) => command.name === "compact")?.availability.enabled, true);
  assert.equal(catalog.actions.find((action) => action.name === "reload")?.enabled, true);
  const model = await f.send(id, "/model verification/faux");
  assert.equal(model.status, "completed", JSON.stringify(model));
  assert.equal(model.data.model, "verification/faux");
  const thinking = await f.request("nativeAction", { sessionId: id, requestId: crypto.randomUUID(), action: "thinking", args: { level: "low" } });
  assert.equal(thinking.status, "completed", JSON.stringify(thinking));
  assert.equal(thinking.data.thinkingLevel, "low");
  assert.equal((await f.send(id, "/trust")).status, "unavailable");
  const unchanged = await f.request("state", { sessionId: id });
  assert.equal(unchanged.state, "sleeping");
  assert.equal(unchanged.streamId, sleeping.streamId);
  const instruction = "Keep the verification decision.";
  try {
    const receipt = await f.send(id, `/compact ${instruction}`);
    assert.equal(receipt.accepted, true, JSON.stringify(receipt));
    assert(JSON.stringify(await until(() => contextSeen, "compaction provider call")).includes(instruction));
    const compacting = f.state(id);
    assert.equal(compacting.operation?.kind, "compact");
    assert.notEqual(compacting.streamId, sleeping.streamId);
    assert.notEqual(compacting.streamId, awake.streamId);
    assert.equal(compacting.thinkingLevel, "low");
    assert(!frames.some((event) => event.type === "operation_completed" && event.operationId === receipt.operationId));
    release.resolve();
    assert.equal((await f.complete(id, receipt)).status, "completed");
    const done = await until(() => frames.find((event) => event.type === "operation_completed" && event.operationId === receipt.operationId), "compact terminal event");
    assert.equal(done.details.status, "completed");
    const pushed = await until(() => frames.find((event) => event.type === "snapshot" && event.sequence === done.sequence), "compaction snapshot");
    const page = await f.request("historyPage", { sessionId: id, through: pushed.details.snapshot.historyThrough });
    assert(page.compactions.some((item) => item.summary.includes("Verification summary")));
    await until(async () => (await f.request("state", { sessionId: id })).state === "sleeping", "session sleep before nativeAction");
    const reloaded = await f.request("nativeAction", { sessionId: id, requestId: crypto.randomUUID(), action: "reload", args: {} });
    assert.equal(reloaded.status, "completed", JSON.stringify(reloaded));
    assert.equal(reloaded.data.reloaded, true);
    assert.equal(f.state(id).state, "idle");
  } finally { release.resolve(); }
});
