import assert from "node:assert/strict";
import test from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

test("create → stream → stop → sleep → explicitly wake the same SDK session", async (t) => {
  const f = await gatewayFixture(t, {
    config: { session: { workerTools: "direct", idleTimeoutMs: 800 } },
    rate: 30,
    answer: () => fauxAssistantMessage("streamed words ".repeat(200)),
  });
  await f.deploy();
  const id = await f.create();
  const events = [];
  f.client.onEvent((event, sessionId) => { if (sessionId === id) events.push(event); });
  const initial = await f.request("subscribe", { sessionId: id });
  const receipt = await f.send(id, "Stream and stop");
  assert.equal(receipt.accepted, true, JSON.stringify(receipt));
  await until(() => events.find((event) => event.type === "message" && event.operationId === receipt.operationId && event.text), "stream delta");
  assert.equal((await f.request("cancel", { sessionId: id, operationId: receipt.operationId })).status, "requested");
  const done = await until(() => events.find((event) => event.type === "operation_completed" && event.operationId === receipt.operationId), "cancel settlement");
  assert.equal(done.details.status, "cancelled");
  const sleeping = await until(async () => {
    const state = await f.request("state", { sessionId: id });
    return state.state === "sleeping" && state;
  }, "sleeping after idle");
  assert.equal(sleeping.sessionId, id);
  assert.notEqual(sleeping.streamId, initial.streamId);
  assert.deepEqual(await f.request("wakeSession", { sessionId: id }), { sessionId: id, sleeping: false });
  assert.equal((await f.request("state", { sessionId: id })).state, "idle");
});
