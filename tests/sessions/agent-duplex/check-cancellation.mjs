import assert from "node:assert/strict";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";

export async function checkDuplexCancellation({ snapshot, send, until, exists, pythonStarted, gateway, idle, peers, modelCalls, command, text, b, c, d }) {
  let counter = 0;
    // B3 uses native history, public wrapped host seams and owned filesystem markers.
    const notices = (name, start = 0) => snapshot(name).messages.slice(start).filter((message) => message.role === "custom" && message.customType === "gateway-peer-discard-notice");
    function checkNotice(name, start, delivered, never, reason) {
      const found = notices(name, start);
      assert.equal(found.length, 1, "Exactly one native discard notice is appended");
      assert.equal(found[0].display, false);
      const body = text(found[0]);
      const deliveredAt = body.indexOf("Delivered but unprocessed"), neverAt = body.indexOf("Never delivered");
      assert(deliveredAt >= 0 && neverAt >= 0, body);
      for (const [entries, at, other] of [[delivered, deliveredAt, neverAt], [never, neverAt, deliveredAt]]) {
        const section = body.slice(at, other > at ? other : undefined);
        for (const { id, sender } of entries) {
          const lines = section.split("\n").filter((line) => line.includes(id));
          assert.equal(lines.length, 1, `One notice line for accepted ${id}`);
          assert(lines[0].includes(snapshot(sender).sessionId) && lines[0].includes(reason), lines[0]);
          assert.equal(body.split(id).length - 1, 1, "UUID is not duplicated across classes");
        }
      }
      return body;
    }
    const cancelStart = snapshot(d).messages.length;
    const processLong = await send(c, d, "PROCESSLONG-B3");
    assert.deepEqual([processLong.accepted, processLong.delivery, processLong.pending], [true, "delivered", 0]);
    await until(() => exists(pythonStarted), "actual blocked Python wrote its owned marker");
    const cancelledId = snapshot(d).operation.operationId;
    const sdkPeer = await send(b, d, "B3-SDK-QUEUED");
    assert.deepEqual([sdkPeer.accepted, sdkPeer.delivery, sdkPeer.pending], [true, "queued", 1]);
    await gateway.session(d).flushPeerInbox();
    assert.deepEqual(snapshot(d).queuedMessages.steering.flatMap((body) => parsePeerMessages(body) ?? []).map((peer) => peer.messageId), [sdkPeer.id]);
    const inboxPeer = await send(c, d, "B3-INBOX-QUEUED");
    assert.deepEqual([inboxPeer.accepted, inboxPeer.delivery, inboxPeer.pending], [true, "queued", 1]);
    const userTexts = ["B3-USER-STEER", "B3-USER-FOLLOWUP"];
    for (const [index, queue] of ["steer", "followUp"].entries()) assert((await gateway.session(d).submit({ requestId: `cancel-user-${++counter}`, message: userTexts[index], queue })).accepted);
    const cancelEvents = [];
    const unsubscribeCancel = gateway.session(d).subscribe((event) => { if (["operation_cancel_requested", "operation_completed"].includes(event.type)) cancelEvents.push(event); });
    const cancelled = await gateway.session(d).cancel({ operationId: cancelledId });
    assert.equal(cancelled.status, "requested");
    assert.deepEqual(cancelled.returnedMessages, userTexts, "Only actual user strings return to composer");
    const cancelledCompletion = await cancelled.completion;
    unsubscribeCancel.unsubscribe();
    assert(["cancelled", "unknown"].includes(cancelledCompletion.status), "Python abort retains authoritative side-effect uncertainty");
    assert.deepEqual(cancelledCompletion.returnedMessages, userTexts);
    assert.deepEqual(cancelEvents.find((event) => event.type === "operation_cancel_requested").details.returnedMessages, userTexts);
    assert.deepEqual(cancelEvents.find((event) => event.type === "operation_completed").details.returnedMessages, userTexts);
    assert.deepEqual(snapshot(d).recentOperations.find((operation) => operation.operationId === cancelledId).returnedMessages, userTexts);
    await idle(d);
    assert.deepEqual(snapshot(d).queuedMessages, { steering: [], followUp: [] });
    assert.deepEqual(peers(d, cancelStart).map((peer) => peer.messageId), [processLong.id], "No backlog replay at settlement");
    assert.equal(notices(d, cancelStart).length, 0, "Notice waits for explicit input");
    const beforeNextCalls = modelCalls.length;
    const next = await command(d, "B3-EXPLICIT-NEXT");
    assert.equal((await next.completion).status, "completed");
    const cancelNotice = checkNotice(d, cancelStart, [{ ...processLong, sender: c }], [{ ...sdkPeer, sender: b }, { ...inboxPeer, sender: c }], "User cancelled the previous run.");
    for (const userText of userTexts) assert(!cancelNotice.includes(userText), "User drafts excluded from notice");
    const nextMessages = snapshot(d).messages.slice(cancelStart);
    const nextIndex = nextMessages.findIndex((message) => message.role === "user" && text(message) === "B3-EXPLICIT-NEXT");
    assert.equal(nextMessages[nextIndex - 1].customType, "gateway-peer-discard-notice", "Notice immediately precedes explicit input");
    const nextCalls = modelCalls.slice(beforeNextCalls);
    assert.equal(nextCalls.length, 1, "Notice does not trigger a separate provider turn");
    assert(nextCalls[0].bodies.some((body) => body.includes(processLong.id) && body.includes("Never delivered")), "Provider context observes notice");
    const later = await command(d, "B3-LATER");
    assert.equal((await later.completion).status, "completed");
    assert.equal(notices(d, later.start).length, 0, "Later run does not append notice again");
    assert.deepEqual(peers(d, cancelStart).map((peer) => peer.messageId), [processLong.id]);
  return { notices, processLong, sdkPeer, inboxPeer, cancelled };
}
