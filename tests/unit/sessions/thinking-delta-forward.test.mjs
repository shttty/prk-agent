import assert from "node:assert/strict";
import test from "node:test";
import { observeSdkEvents } from "../../../src/sessions/host/sdk-events/observe-sdk-events.ts";

test("thinking deltas reach observers as message events marked part:thinking; text and toolcall updates stay distinct", () => {
  const events = [];
  const ctx = { closed: false, sequence: 0, deliveries: [], dispatching: false, sessionId: "w", streamId: "s", active: { id: "op" }, listeners: new Set([(event) => events.push(event)]) };
  const update = (assistantMessageEvent) => observeSdkEvents(ctx, { type: "message_update", message: {}, assistantMessageEvent });
  update({ type: "thinking_start", contentIndex: 0 });
  update({ type: "thinking_delta", contentIndex: 0, delta: "**Plan**" });
  update({ type: "text_delta", contentIndex: 1, delta: "Hi" });
  update({ type: "toolcall_delta", contentIndex: 2, delta: "{" });
  observeSdkEvents(ctx, { type: "auto_retry_start", attempt: 2, maxAttempts: 3, delayMs: 10, errorMessage: "429" });
  assert.deepEqual(events.map(({ type, operationId, text, details }) => ({ type, operationId, text, details })), [
    { type: "session_event", operationId: "op", text: undefined, details: { sdkType: "message_update", assistantEvent: "thinking_start" } },
    { type: "message", operationId: "op", text: "**Plan**", details: { part: "thinking", contentIndex: 0 } },
    { type: "message", operationId: "op", text: "Hi", details: undefined },
    { type: "session_event", operationId: "op", text: undefined, details: { sdkType: "message_update", assistantEvent: "toolcall_delta" } },
    { type: "session_event", operationId: "op", text: undefined, details: { sdkType: "auto_retry_start", attempt: 2, maxAttempts: 3 } },
  ]);
});
