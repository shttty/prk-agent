import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { gatewayFixture, text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

test("fork a saved reply while the source operation and its queue are still active", async (t) => {
  const release = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const f = await gatewayFixture(t, { async answer(context) {
    const prompt = text(context.messages.at(-1));
    if (prompt === "Active prompt") { entered.resolve(); await release.promise; }
    return fauxAssistantMessage(`Reply to ${prompt}`);
  } });
  await f.stageArtifacts();
  const source = await f.create();
  const saved = await f.send(source, "Saved prompt");
  assert.equal((await f.complete(source, saved)).status, "completed");
  const history = async (sessionId) => f.request("historyPage", { sessionId, through: (await f.request("state", { sessionId })).historyThrough });
  const page = await history(source);
  const entryId = page.messageEntryIds.at(-1);
  assert.equal(text(page.messages.at(-1)), "Reply to Saved prompt");
  const native = (action, args = {}) => f.request("nativeAction", { sessionId: source, requestId: crypto.randomUUID(), action, args });
  try {
    const running = await f.send(source, "Active prompt");
    await entered.promise;
    const queued = await f.send(source, "Queued prompt", { queue: "followUp" });
    assert.equal(queued.operationId, running.operationId);
    for (const action of ["new", "clone"]) assert.equal((await native(action)).status, "unavailable");
    const fork = await native("fork-reply", { entryId });
    assert.equal(fork.status, "completed", JSON.stringify(fork));
    assert.equal(fork.data.sourceSessionId, source);
    assert.equal(fork.data.forkEntryId, entryId);
    assert.notEqual(fork.data.session.sessionId, source);
    assert.equal(f.state(source).operation.operationId, running.operationId);
    assert.deepEqual(f.state(source).queuedMessages.followUp, ["Queued prompt"]);
    const branch = await history(fork.data.session.sessionId);
    assert.deepEqual(branch.messages.filter(({ role }) => role === "user" || role === "assistant").map(text), ["Saved prompt", "Reply to Saved prompt"]);
    release.resolve();
    assert.equal((await f.complete(source, running)).status, "completed");
    await until(() => f.state(source).messages.some((message) => text(message) === "Reply to Queued prompt"), "original queue drained");
    assert.deepEqual((await history(fork.data.session.sessionId)).messages.map(text), branch.messages.map(text));
    assert.deepEqual(await f.request("closeSession", { sessionId: source }), { closed: true });
    assert.equal((await f.request("state", { sessionId: source })).state, "closed");
    const fromClosed = await native("fork-reply", { entryId });
    assert.equal(fromClosed.status, "completed", JSON.stringify(fromClosed));
    assert.deepEqual((await history(fromClosed.data.session.sessionId)).messages.map(text), branch.messages.map(text));
  } finally { release.resolve(); }
});
