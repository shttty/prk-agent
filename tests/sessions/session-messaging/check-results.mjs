import assert from "node:assert/strict";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";
import { waitForSessionCondition } from "../derivation/wait-for-session-condition.mjs";

export async function checkResults(f, owner) {
  const child = await f.spawn(owner, "Receipt-driven temporary child archive", "temporary");
  const childRoute = f.get(child.sessionId).sessionId;
  const sender = await f.create("Result batch peer");
  const busy = await f.hold(owner);
  const normal = await f.call(sender, "session_send", { to: f.get(owner).sessionId, message: "NORMAL_BEFORE_RESULT", expectReply: false });
  const lifecycle = [], hostedErrors = [];
  let deliveredWhileRunning = false;
  const childEvents = f.host.session(childRoute).subscribe((event) => {
    if (event.type === "session_event" && event.details?.sdkType === "tool_execution_end" && event.details.toolName === "session_result") {
      lifecycle.push("result");
      deliveredWhileRunning = f.get(child.sessionId)?.derivation?.phase === "delivered";
    }
    if (event.type === "session_event" && event.details?.sdkType === "agent_settled") lifecycle.push("settled");
    if (event.type === "operation_completed") lifecycle.push(event.details.status);
    if (event.type === "operation_cancel_requested") lifecycle.push("cancel_requested");
    for (const notice of event.details?.extensionUi?.notifications ?? []) if (notice.type === "error") hostedErrors.push(notice.message);
  });
  const stopArchiveEvents = f.host.subscribeSessions((event) => {
    if (event.type === "session_archived" && event.sessionId === childRoute) lifecycle.push("archived");
  });
  let submitted;
  try {
    submitted = await f.call(child.sessionId, "session_result", { summary: "RESULT_BATCH_PROOF file.txt:12; command: true; exit 0", artifacts: ["target-only.txt"], output: { answer: 42 } });
    await waitForSessionCondition(() => !f.get(child.sessionId) && f.host.workbench().archive.some(({ group }) => group === childRoute), "settled task archive");
  } finally {
    childEvents.unsubscribe();
    stopArchiveEvents();
  }
  assert(deliveredWhileRunning, "Receipt marks delivered while the submitting child is still running");
  assert.deepEqual(lifecycle, ["result", "settled", "completed", "archived"], "Archive follows SDK settlement and successful operation completion, without cancellation");
  assert.deepEqual(hostedErrors, [], "Normal task submission and archive emit no hosted-handler errors");
  const receiptEntries = await f.entries(f.get(owner).sessionId);
  const receipts = receiptEntries.filter((entry) => entry.type === "custom" && entry.customType === "gateway-derived-receipt" && entry.data.child === child.sessionId && entry.data.taskId === child.taskId && entry.data.result.id === submitted.resultId);
  assert.equal(receipts.length, 1, "The parent's native SDK history owns exactly one delivery receipt");
  assert.equal(receipts[0].data.sessionId, f.get(owner).sessionId);
  assert(!f.get(child.sessionId), "A normally completed task archives without any parent acknowledgment call");
  const archive = f.host.workbench().archive.find(({ group }) => group === childRoute).sessions.find(({ sessionId }) => sessionId === child.sessionId);
  assert.equal(archive.sessionId, child.sessionId, "Automatic archive preserves the native child identity");
  const taskState = (await f.entries(child.sessionId)).findLast((entry) => entry.type === "custom" && entry.customType === "gateway-derived-session").data;
  assert.equal(taskState.phase, "delivered", "Native task metadata becomes delivered when receipt is written");
  assert.equal(taskState.result.id, submitted.resultId);
  assert.equal(f.peers(owner, busy.start).length, 0, "Result and ordinary message wait in the existing busy inbox");
  await busy.release();
  const batches = f.host.state(owner).messages.slice(busy.start).filter((message) => message.role === "user").map((message) => parsePeerMessages(f.text(message))).filter(Boolean);
  assert.equal(batches.length, 1, "Result and ordinary message are one SDK envelope, not a separate notification");
  assert.equal(batches[0].length, 2);
  assert.equal(batches[0][0].messageId, normal.id, "The ordinary message retains its chronological place");
  const delivered = batches[0][1];
  const payload = JSON.parse(delivered.body.split("\n").find((line) => line.startsWith("{")));
  assert.deepEqual(payload, { child: child.sessionId, taskId: child.taskId, result: receipts[0].data.result });
  assert.equal(delivered.sender, child.sessionId);
  assert.equal(delivered.expectReply, false);
  assert(f.requests.some(({ messages }) => messages.some((message) => parsePeerMessages(f.text(message))?.some(({ body }) => body.includes(submitted.resultId)))), "The actual parent provider consumes the merged result");
  assert(!f.host.state(owner).messages.slice(busy.start).some((message) => message.customType === "gateway-internal-notification"), "Result delivery does not also publish the removed notification path");
  const retained = await f.spawn(owner, "Persistent lifecycle delivery");
  await f.call(retained.sessionId, "session_result", { summary: "Persistent child remains alive" });
  await f.idle(owner);
  assert.equal(f.get(retained.sessionId).derivation.phase, "delivered");
  assert(!f.host.workbench().archive.some(({ sessions }) => sessions.some(({ sessionId }) => sessionId === retained.sessionId)), "Persistent lifecycle does not autoarchive on delivery");
  await f.call(owner, "session_manage", { action: "destroy", child: retained.sessionId });
}
