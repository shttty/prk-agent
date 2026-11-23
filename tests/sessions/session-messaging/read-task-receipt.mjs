import assert from "node:assert/strict";
import { readSessionEntries } from "./read-session-entries.mjs";

export async function readTaskReceipt({ cwd, recipientCwd, directory, task, params, outcome, toolResult }) {
  assert.equal(outcome.status, "completed", "Receipt delivery lets the task's submitting operation finish normally");
  const receipts = (await readSessionEntries(recipientCwd, directory, task.recipientSessionId)).filter((entry) => entry.type === "custom" && entry.customType === "gateway-derived-receipt" && entry.data.sessionId === task.recipientSessionId && entry.data.child === task.sessionId && entry.data.taskId === task.taskId);
  assert.equal(receipts.length, 1, "Stopped task has exactly one native owner receipt for its exact child/task identity");
  const result = receipts[0].data.result;
  assert.equal(result.summary, params.summary);
  assert.deepEqual(result.artifacts, params.artifacts ?? []);
  assert.deepEqual(result.output, params.output, "Normal task completion preserves validated structured output");
  const state = (await readSessionEntries(cwd, directory, task.sessionId)).findLast((entry) => entry.type === "custom" && entry.customType === "gateway-derived-session" && entry.data.sessionId === task.sessionId).data;
  assert.equal(state.phase, "delivered");
  assert.equal(state.taskId, task.taskId);
  assert.deepEqual(state.result, result, "Native child result and owner receipt agree after normal completion");
  assert(toolResult, "The real SDK retains the task result before disposing its runtime");
  assert.equal(toolResult.isError, false, "Stopping the delivered task must not replace its successful tool result with an error");
  const content = toolResult.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const submitted = JSON.parse(content);
  assert.equal(submitted.resultId, result.id, "The successful SDK tool result agrees with the native receipt");
  assert.equal(submitted.phase, state.phase);
  return { resultId: result.id, phase: state.phase };
}
