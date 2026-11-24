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

test("/compact acknowledges before the model, publishes its operation, then persists a compaction marker", async (t) => {
  const f = await gatewayFixture(t);
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
  }]);
  const frames = [];
  f.client.onEvent((event) => frames.push(event));
  await f.request("subscribe", { sessionId: id });
  const instruction = "Keep the verification decision.";
  try {
    const receipt = await f.send(id, `/compact ${instruction}`);
    assert.equal(receipt.accepted, true, JSON.stringify(receipt));
    assert(JSON.stringify(await until(() => contextSeen, "compaction provider call")).includes(instruction));
    assert.equal(f.state(id).operation?.kind, "compact");
    assert(!frames.some((event) => event.type === "operation_completed"));
    release.resolve();
    assert.equal((await f.complete(id, receipt)).status, "completed");
    const done = await until(() => frames.find((event) => event.type === "operation_completed" && event.operationId === receipt.operationId), "compact terminal event");
    assert.equal(done.details.status, "completed");
    const pushed = await until(() => frames.find((event) => event.type === "snapshot" && event.sequence === done.sequence), "compaction snapshot");
    const page = await f.request("historyPage", { sessionId: id, through: pushed.details.snapshot.historyThrough });
    assert(page.compactions.some((item) => item.summary.includes("Verification summary")));
  } finally { release.resolve(); }
});
