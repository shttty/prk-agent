import assert from "node:assert/strict";
import { join } from "node:path";

export async function checkLiveCancellation({ create, root, send, until, exists, state, receipts, peers, client, terminal, print, text }) {
        const receiver = await create("Cancel recipient");
        const sender = await create("Cancel sender");
        const marker = join(root, "cancel-busy");
        const finished = join(root, "cancel-finished");
        const busy = await send(receiver, `This is an authorized cancellation test. Call kernel_code exactly once with:\nimport time\nfrom pathlib import Path\nPath(${JSON.stringify(marker)}).write_text('busy')\ntime.sleep(120)\nPath(${JSON.stringify(finished)}).write_text('finished')\nThen finish. Do not retry if interrupted.`);
        await until(() => exists(marker), "recipient entered real Python execution");
        assert((await state(receiver)).operation, "recipient must be busy before backlog is sent");
        const sending = await send(sender, `Call session_send exactly THREE times, each to ${receiver.sessionId}, expectReply true, no replyTo, with these separate questions: 'What is 2 plus 2?', 'What is the capital of France?', 'How many days in a leap year?'. Do not wait for replies. Finish immediately after the three accepted sends. Do not retry errors.`);
        let accepted;
        await until(async () => {
          accepted = receipts(await state(sender));
          return accepted.length >= 3;
        }, "three peer messages accepted while recipient is busy", 90_000);
        assert.equal(accepted.length, 3, "real sender must send exactly the requested backlog");
        assert.equal(new Set(accepted.map((receipt) => receipt.id)).size, 3, "backlog carries three distinct peer IDs");
        const before = await state(receiver);
        assert.equal(before.operation?.operationId, busy.operationId, "cancel targets the still-busy original operation");
        assert.equal(await exists(finished), false, "long Python call must not have finished before cancel");
        for (const receipt of accepted) {
          assert.equal(receipt.accepted, true);
          assert.equal(receipt.to, receiver.sessionId);
          assert.equal(receipt.expectReply, true, "real sender accepted a question that expects a reply");
          assert.equal(receipt.delivery, "queued", "peer backlog was accepted during real execution");
          assert.equal(peers(before).filter((peer) => peer.messageId === receipt.id).length, 0, "backlog not yet consumed in authoritative transcript");
        }
        const cancelled = await client.request("cancel", { sessionId: receiver.id, operationId: busy.operationId });
        assert.equal(cancelled.status, "requested");
        assert(Array.isArray(cancelled.returnedMessages) && cancelled.returnedMessages.every((message) => typeof message === "string"), "cancel returns returnedMessages:string[]");
        assert.deepEqual(cancelled.returnedMessages, [], "peer envelopes are notices, not returned user drafts");
        // SessionHost intentionally reports unknown after Python started: target
        // effects are not rolled back. Only these abort-terminal classes are valid.
        const abortedOutcome = await terminal(receiver, busy, ["cancelled", "unknown"]);
        await terminal(sender, sending);
        assert.equal(await exists(finished), false, "cancel interrupted the owned Python execution");
        const aborted = await state(receiver);
        assert.equal(aborted.operation, undefined, "cancelled operation has fully settled before explicit restart");
        for (const receipt of accepted) assert.equal(peers(aborted).filter((peer) => peer.messageId === receipt.id).length, 0, "cancel never consumes accepted backlog");
        assert.equal(aborted.messages.filter((message) => message.customType === "gateway-peer-discard-notice").length, 0, "notice waits for explicit next run");
        const next = await send(receiver, "The previous run was intentionally cancelled. Read the gateway peer discard notice and summarize its sender, message IDs and reason in one sentence. Do not execute Python, contact peers, or retry the cancelled task.");
        await terminal(receiver, next);
        receiver.state = await state(receiver); sender.state = await state(sender);
        print(sender); print(receiver);
        const notices = receiver.state.messages.filter((message) => message.customType === "gateway-peer-discard-notice");
        assert.equal(notices.length, 1, "next run receives exactly one authoritative custom discard notice");
        const notice = text(notices[0]);
        assert.match(notice, /Never delivered|Delivered but unprocessed/, "notice distinguishes peer discard classes");
        assert.match(notice, /Never delivered/, "the unconsumed backlog is classified never delivered");
        assert(notice.includes("User cancelled the previous run."), "notice includes the authoritative cancellation reason");
        assert(notice.includes(sender.sessionId), "notice contains sender identity");
        for (const receipt of accepted) {
          assert.match(receipt.id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, "accepted peer ID is a UUID");
          assert.equal(notice.split(receipt.id).length - 1, 1, `notice identifies discarded peer ${receipt.id} exactly once`);
          assert.equal(peers(receiver.state).filter((peer) => peer.messageId === receipt.id).length, 0, "discarded peers are not silently replayed on next run");
        }
        assert.equal(notices[0].role, "custom", "notice is authoritative SDK custom history, not assistant prose");
        assert.equal(await exists(finished), false, "explicit next run never resumed or replayed interrupted Python");
        const pythonCalls = receiver.state.messages.filter((message) => message.role === "assistant")
          .flatMap((message) => Array.isArray(message.content) ? message.content : [])
          .filter((part) => part.type === "toolCall" && part.name === "kernel_code");
        assert.equal(pythonCalls.length, 1, "recipient executed the scripted Python call exactly once, never replayed it");
        assert.equal(receipts(sender.state).length, 3, "sender did not add or retry backlog after cancellation");
        for (const person of [receiver, sender]) assert.equal(person.state.messages.filter((message) => message.role === "toolResult" && message.toolName === "session_send" && message.isError).length, 0, `${person.label}: no failed or duplicate sends`);
        assert.equal(receipts(receiver.state).length, 0, "explicit next run never contacted peers for discarded questions");
        console.log(`ABORT OUTCOME ${abortedOutcome.status}: cancellation does not claim target-side rollback.`);
        console.log(`PASS: REAL busy backlog -> cancel -> explicit next run -> authoritative discard notice for ${accepted.length} peer UUIDs with sender and reason; returnedMessages is a string array. Delivered-but-unprocessed/refusal cases are not exercised by this scenario.`);
}
