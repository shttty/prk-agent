import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { waitForSessionCondition } from "../derivation/wait-for-session-condition.mjs";

export async function checkLiveObservation(f, owner) {
  const child = await f.spawn(owner, "Live assistant observation");
  const route = f.get(child.sessionId).sessionId;
  const provider = fauxProvider({ provider: "session-observation-stream", models: [{ id: "slow" }], tokensPerSecond: 100, tokenSize: { min: 8, max: 8 } });
  f.modelRuntime.registerNativeProvider(provider.provider);
  await f.modelRuntime.refresh({ allowNetwork: false });
  const content = `LIVE_ASSISTANT_${"streaming text ".repeat(300)}`;
  provider.setResponses([fauxAssistantMessage(content)]);
  const switched = await f.client.request("nativeAction", { sessionId: route, requestId: randomUUID(), action: "model", args: { model: "session-observation-stream/slow" } });
  assert.equal(switched.status, "completed", JSON.stringify(switched));
  let streamed = "";
  const subscription = f.host.session(route).subscribe((event) => {
    if (event.type === "message") streamed += event.text ?? "";
  });
  const run = await f.host.session(route).submit({ requestId: randomUUID(), message: "Produce the controlled live text." });
  assert.equal(run.accepted, true);
  try {
    await waitForSessionCondition(() => streamed.length >= 32, "first native assistant text delta");
    const first = await f.call(owner, "session_list", { sessionId: child.sessionId, limit: 1 });
    assert.equal(first.state, "running");
    assert.equal(first.recent.length, 1);
    assert.equal(first.recent[0].role, "assistant");
    assert(first.recent[0].text.startsWith("LIVE_ASSISTANT_"));
    assert(first.recent[0].text.length < content.length, "Observation reads current deltas, not a precomputed final answer");
    await waitForSessionCondition(() => streamed.length > first.recent[0].text.length + 32, "later native assistant text delta");
    const second = await f.call(owner, "session_list", { sessionId: child.sessionId, limit: 1 });
    assert.equal(second.state, "running");
    assert(second.recent[0].text.startsWith(first.recent[0].text));
    assert(second.recent[0].text.length > first.recent[0].text.length, "Two reads in one running turn observe fresh assistant text");
    assert(second.recent[0].text.length <= 600);
    assert.equal(provider.state.callCount, 1, "Observation invokes no target model request");
    assert.equal(f.host.state(route).operation.operationId, run.operationId);
  } finally {
    await f.host.session(route).cancel({ operationId: run.operationId });
    await run.completion;
    subscription.unsubscribe();
  }
}
