import assert from "node:assert/strict";
import { readTaskReceipt } from "../session-messaging/read-task-receipt.mjs";

export async function callSessionTool(ctx, name, tool, args, expectedError, requestId) {
  await ctx.idle(name);
  const current = ctx.host.workbench().sessions.find((worker) => worker.sessionId === name);
  const owner = current?.derivation?.owner;
  const task = tool === "session_result" && !expectedError && current?.derivation?.lifecycle === "temporary" ? { name, sessionId: current.sessionId, taskId: current.derivation.taskId, recipientSessionId: ctx.host.workbench().sessions.find((worker) => worker.sessionId === owner).sessionId } : undefined;
  const runtime = ctx.host.session(name), start = runtime.getSnapshot().messages.length;
  const operation = await runtime.submit({ requestId, message: `TOOL ${JSON.stringify({ tool, args })}` });
  assert(operation.accepted, JSON.stringify(operation));
  const outcome = await operation.completion;
  assert.equal(outcome.status, "completed", JSON.stringify(outcome));
  const snapshot = runtime.getSnapshot();
  const projected = snapshot.messages.slice(start).findLast((message) => message.role === "toolResult" && message.toolName === tool);
  const result = projected?.outputPreview ? (await ctx.client.request("toolContent", { sessionId: name, toolCallId: projected.toolCallId })).result : projected;
  assert(result, `${tool} executed through the real SDK`);
  if (expectedError) { assert.equal(result.isError, true, ctx.text(result)); if (expectedError instanceof RegExp) assert.match(ctx.text(result), expectedError); return; }
  assert(!result.isError, ctx.text(result));
  if (task) return readTaskReceipt({ cwd: current.cwd, recipientCwd: ctx.host.workbench().sessions.find((worker) => worker.sessionId === owner).cwd, directory: ctx.directory, task, params: args, outcome, toolResult: result });
  return tool === "kernel_code" || ctx.nativeNames.includes(tool) ? result : JSON.parse(ctx.text(result));
}
