import assert from "node:assert/strict";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";

export async function checkTransfer(f, owner) {
  const receiver = await f.create("Directed transfer recipient");
  const child = await f.spawn(owner, "Transfer preserves creator and task");
  const source = await f.spawn(receiver, "Result joins a transfer-offer inbox", "temporary");
  const original = structuredClone(f.get(child.sessionId).derivation);
  const busy = await f.hold(receiver);
  const normal = await f.call(owner, "session_send", { to: f.get(receiver).sessionId, message: "NORMAL_BEFORE_OFFER", expectReply: false });
  await f.call(owner, "session_manage", { action: "transfer", child: child.sessionId, to: f.get(receiver).sessionId });
  assert.equal(f.get(child.sessionId).derivation.owner, owner, "The proposer remains responsible until explicit acceptance");
  assert.equal(f.get(child.sessionId).derivation.pendingOwner, receiver);
  const offered = (await f.call(owner, "session_list")).find((row) => row.sessionId === child.sessionId);
  assert.equal(offered.parentSessionId, f.get(owner).sessionId);
  assert.equal(offered.pendingParentSessionId, f.get(receiver).sessionId);
  const queuedResult = await f.call(source.sessionId, "session_result", { summary: "RESULT_WITH_OFFER" });
  assert.equal(f.peers(receiver, busy.start).length, 0);
  await busy.release();
  const batches = f.host.state(receiver).messages.slice(busy.start).filter((message) => message.role === "user").map((message) => parsePeerMessages(f.text(message))).filter(Boolean);
  assert.equal(batches.length, 1, "Ordinary message, transfer offer and result share one existing inbox envelope");
  assert.equal(batches[0].length, 3);
  assert.equal(batches[0][0].messageId, normal.id);
  assert(batches[0][1].body.includes(child.sessionId), "The recipient receives the directed child offer without polling");
  assert(batches[0][1].body.includes(f.get(owner).sessionId), "The offer identifies the original owner's native session");
  assert(batches[0][2].body.includes(queuedResult.resultId));
  assert(batches[0].every((entry) => entry.batch?.id === batches[0][0].batch.id), "All three consumer inputs preserve one ordered batch identity");
  await f.call(receiver, "session_list", { sessionId: child.sessionId }, /control|authority|owner|ancestor|supervisor|root/i);
  for (const args of [
    { action: "destroy", child: child.sessionId },
    { action: "transfer", child: child.sessionId, to: f.get(owner).sessionId },
    { action: "project", session: child.sessionId, project: "Not authorized by offer" },
  ]) await f.call(receiver, "session_manage", args, /control|authority|owner|ancestor|supervisor|root/i);
  await f.call(receiver, "session_send", { to: child.sessionId, message: "Offer is not general control", delivery: "abort" }, /control|authority|owner|ancestor|supervisor|root/i);
  const other = await f.create("Not the offered recipient");
  await f.call(other, "session_manage", { action: "accept", child: child.sessionId }, /offer|pending|recipient|transfer/i);
  await f.call(receiver, "session_manage", { action: "accept", child: child.sessionId });
  const accepted = f.get(child.sessionId).derivation;
  assert.equal(accepted.owner, receiver, "pendingOwner may accept without pre-existing general control");
  assert.equal(accepted.pendingOwner, undefined);
  for (const key of ["createdBy", "taskId", "task", "context", "lifecycle"]) assert.deepEqual(accepted[key], original[key], `${key} survives transfer`);
  await f.call(owner, "session_manage", { action: "destroy", child: child.sessionId }, /control|authority|owner|ancestor|supervisor|root/i);
  const oldStart = f.host.state(owner).messages.length, newStart = f.host.state(receiver).messages.length;
  const result = await f.call(child.sessionId, "session_result", { summary: "RESULT_TO_ACCEPTED_OWNER" });
  await f.idle(receiver);
  assert(f.peers(receiver, newStart).some(({ body }) => body.includes(result.resultId)), "Subsequent result goes to the accepted owner");
  assert(!f.peers(owner, oldStart).some(({ body }) => body.includes(result.resultId)), "The old owner receives no duplicate result");
  const receipt = (await f.entries(f.get(receiver).sessionId)).filter((entry) => entry.type === "custom" && entry.customType === "gateway-derived-receipt" && entry.data.child === child.sessionId && entry.data.result.id === result.resultId);
  assert.equal(receipt.length, 1);
  assert.equal(receipt[0].data.sessionId, f.get(receiver).sessionId);
  assert.equal(f.get(child.sessionId).derivation.createdBy, owner);
  await f.call(receiver, "session_manage", { action: "destroy", child: child.sessionId });
}
