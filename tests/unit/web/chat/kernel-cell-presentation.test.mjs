import assert from "node:assert/strict";
import test from "node:test";
import { kernelCellPresentation } from "../../../../web/chat/transcript/tool-calls/kernel-cell/kernel-cell-presentation.js";
import { selectKernelEvent } from "../../../../web/chat/transcript/tool-calls/kernel-cell/select-kernel-event.js";
import { projectConversation } from "../../../../web/chat/conversation/project-conversation.js";

const identity = { sessionId: "session-a", kernelId: "kernel-a", cellId: "cell-a", toolCallId: "tool-a", startedAt: 100 };
const event = (kind, details = {}, content = []) => ({ role: "custom", customType: "kernel-event", content,
  details: { ...identity, kind, eventId: `cell-a:${kind === "finished" ? "finished" : "checkpoint:1"}`, step: 1, activeMs: 500, elapsedMs: 700, ...details } });
const present = (values = {}) => kernelCellPresentation({ ...identity, ...values });

test("live cell output, ask and truncation belong to the complete identity", () => {
  const active = { ...identity, output: "bounded live output", waitingForAsk: true, truncated: true, elapsedMs: 700, activeMs: 500, imageCount: 2 };
  const checkpoint = event("checkpoint");
  const row = present({ active, checkpoint });
  assert.equal(row.status, "running");
  assert.equal(row.output, active.output);
  assert.equal(row.waitingForAsk, true);
  assert.equal(row.truncated, true);
  assert.equal(row.elapsedMs, 700);
  assert.equal(row.checkpoint.step, 1);
  for (const key of ["sessionId", "kernelId", "cellId", "toolCallId"]) {
    const wrong = event("finished", { [key]: "other", outcome: "error" });
    assert.equal(present({ active, finished: wrong }).status, "running", key);
  }
  assert.equal(present({ active: { ...active, kernelId: undefined } }), null);
});

test("finished events preserve actual outcomes and saved notification states", () => {
  const delivery = { ...identity, delivery: "unconfirmed", outcome: "aborted", imageCount: 2, notice: "unconfirmed reason", finishedAt: 900 };
  const pending = present({ delivery });
  assert.equal(pending.status, "aborted");
  assert.equal(pending.notice, delivery.notice);
  assert.equal(pending.delivery, "unconfirmed");
  for (const outcome of ["ok", "error", "aborted", "unknown"]) {
    const finished = event("finished", { outcome, imageCount: 2, finishedAt: 900 }, [{ type: "text", text: "event introduction" }, { type: "text", text: "final formatter output" }]);
    const row = present({ delivery, finished });
    assert.equal(row.status, outcome);
    assert.equal(row.delivery, "unconfirmed", "transient SDK message_end is not a native history receipt");
    assert.equal(row.output, "final formatter output");
    assert.equal(row.waitingForAsk, false);
    assert.equal(row.imageCount, 2);
  }
});

test("native events locate one historical/live tool row without duplicate completions", () => {
  const checkpoint = event("checkpoint");
  const stale = event("checkpoint", { kernelId: "old-kernel", step: 9, eventId: "cell-a:checkpoint:9" });
  assert.equal(selectKernelEvent([checkpoint, stale], identity.sessionId, identity.toolCallId, "checkpoint", identity), checkpoint);
  assert.equal(selectKernelEvent([event("finished", { eventId: "wrong" })], identity.sessionId, identity.toolCallId, "finished", identity), undefined);
  const messages = [{ role: "assistant", stopReason: "toolUse", content: [{ type: "toolCall", id: identity.toolCallId, name: "kernel_code", arguments: { code: "print(1)" } }] },
    { role: "toolResult", toolCallId: identity.toolCallId, toolName: "kernel_code", content: [{ type: "text", text: '{"status":"running","cell_id":"cell-a"}' }] }, checkpoint, event("finished", { outcome: "ok" })];
  const state = { selectedSessionId: identity.sessionId, session: { snapshot: { sessionId: identity.sessionId, messages }, toolRuns: new Map([["session-a:tool-a", { toolCallId: identity.toolCallId, toolName: "kernel_code", ended: true }]]), streams: new Map(), operations: new Map(), nativeFeedback: [] } };
  const conversation = projectConversation(state);
  assert.equal(conversation.flatMap((row) => row.content).filter((part) => part.type === "tool-call").length, 1);
  assert.equal(conversation.filter((row) => row.metadata?.custom?.kernelEvent).length, 2);
  assert.equal(JSON.stringify(conversation).includes("event introduction"), false);
});
