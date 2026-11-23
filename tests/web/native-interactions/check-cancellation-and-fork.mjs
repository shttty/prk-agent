// Observe the real SSE stream without replacing or patching the application's EventSource.
// Render a real execution tool turn before using the reply controls.
// A finished turn folds its tool calls under one process summary; open it, then the execution row.
// Fork sits beside copy on a persisted assistant reply; it opens a live branch and leaves the source alone.
// 从这里重来 / 改了重发 live on the user's own messages and first ask where to happen.
// "分叉到新会话" needs a persisted reply before the message; check the first rerunnable message against the page order.
// 改了重发 → 分叉到新会话: a new session from the reply before the message, original text back in its composer.
import assert from "node:assert/strict";

export async function checkCancellationAndFork(ctx) {
Object.defineProperties(ctx, {
    forkSessionId: { configurable: true, get: () => forkSessionId },
    rerunDialog: { configurable: true, get: () => rerunDialog, set: (value) => { rerunDialog = value; } },
    queuedProof: { configurable: true, get: () => queuedProof },
    editFork: { configurable: true, get: () => editFork },
});

await ctx.setQueue(ctx.desktop, "steer");

await ctx.sendUi(ctx.desktop, ctx.cancelSteerText);

await ctx.sendUi(ctx.desktop, ctx.cancelRepeatedText);

await ctx.setQueue(ctx.desktop, "followUp");

await ctx.sendUi(ctx.desktop, ctx.cancelFollowText);

await ctx.sendUi(ctx.desktop, ctx.cancelRepeatedText);

await ctx.desktop.locator("#composer").fill(ctx.cancelRetainedDraft);

const expectedReturned = [ctx.cancelSteerText, ctx.cancelRepeatedText, ctx.cancelFollowText, ctx.cancelRepeatedText];

await ctx.waitForObservation(ctx.desktop, async ({ sessionId, steering, followUp }) => {
    const current = await (await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`)).json();
    return JSON.stringify(current.queuedMessages?.steering) === JSON.stringify(steering)
      && JSON.stringify(current.queuedMessages?.followUp) === JSON.stringify(followUp);
  }, { sessionId: ctx.sessionId, steering: [ctx.cancelSteerText, ctx.cancelRepeatedText], followUp: [ctx.cancelFollowText, ctx.cancelRepeatedText] }, { timeout: 10_000 });

const activeBeforeCancel = await ctx.waitForRunning(ctx.desktop, ctx.sessionId);

const callsBeforeCancel = ctx.modelCalls;

await ctx.desktop.evaluate(({ sessionId, operationId }) => new Promise((resolve) => {
    const source = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
    globalThis.nativeCancelObservation = { source, events: [] };
    source.addEventListener("host", ({ data }) => {
      const event = JSON.parse(data);
      if (event.operationId === operationId && ["operation_cancel_requested", "operation_completed"].includes(event.type)) {
        globalThis.nativeCancelObservation.events.push(event);
      }
    });
    source.addEventListener("snapshot", () => resolve(), { once: true });
  }), { sessionId: ctx.sessionId, operationId: activeBeforeCancel.operationId });

let cancelSendRequests = 0;

const countCancelSend = (request) => { if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/send")) cancelSendRequests++; };

ctx.desktop.on("request", countCancelSend);

const cancelResponsePromise = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/cancel"));

await ctx.desktop.locator("#cancel-operation").click();

const cancelResponse = await cancelResponsePromise;

assert.equal(cancelResponse.status(), 200, "UI cancellation succeeds");

const cancelResult = await ctx.readJsonResponse(cancelResponse);

assert.equal(cancelResult.status, "requested");

assert.deepEqual(cancelResult.returnedMessages, expectedReturned, "cancel returns actual unread SDK user texts, including duplicates");

await ctx.waitForOperationCompletion(ctx.desktop, ctx.sessionId, activeBeforeCancel.operationId);

await ctx.desktop.waitForFunction(() => ["operation_cancel_requested", "operation_completed"].every((type) => globalThis.nativeCancelObservation.events.some((event) => event.type === type)));

const cancelEvents = await ctx.desktop.evaluate(() => {
    globalThis.nativeCancelObservation.source.close();
    const events = globalThis.nativeCancelObservation.events;
    delete globalThis.nativeCancelObservation;
    return events;
  });

for (const event of cancelEvents) assert.deepEqual(event.details.returnedMessages, expectedReturned, `${event.type} carries the same cumulative returns`);

const expectedRestoredDraft = [ctx.cancelRetainedDraft, ...expectedReturned].join("\n\n");

await ctx.desktop.waitForFunction((expected) => document.querySelector("#composer")?.value === expected, expectedRestoredDraft);

await ctx.desktop.locator("#cancel-operation").waitFor({ state: "hidden" });

await ctx.desktop.locator("#restore-queued-messages").waitFor({ state: "hidden" });

assert.equal(await ctx.desktop.locator("#composer").inputValue(), expectedRestoredDraft, "response, cancel event, completion and snapshots restore each queue entry once without overwriting the draft");

await ctx.desktop.locator("#restored-draft-status").waitFor({ state: "visible" });

assert.equal(await ctx.desktop.locator("#restored-draft-status").getAttribute("data-count"), "4", "the composer reports how many returned inputs it holds");

await ctx.desktop.locator('#connection-banner[data-kind="cancel-pending"]').waitFor({ state: "detached" });

assert.equal(await ctx.desktop.locator('#connection-banner[data-kind="cancel-pending"]').count(), 0, "the cancel-pending banner retires once its operation is terminal");

const cancelledSnapshot = await ctx.state(ctx.desktop, ctx.sessionId);

assert.deepEqual(cancelledSnapshot.queuedMessages, { steering: [], followUp: [] }, "SDK queues remain empty after cancellation settles");

assert.deepEqual(cancelledSnapshot.recentOperations.find((operation) => operation.operationId === activeBeforeCancel.operationId)?.returnedMessages, expectedReturned, "authoritative completion snapshot retains cumulative returns");

assert.equal(ctx.modelCalls, callsBeforeCancel, "cancellation does not replay returned messages");

const editedReturnedDraft = "operator edited the returned draft";

await ctx.desktop.locator("#composer").fill(editedReturnedDraft);

await ctx.desktop.reload({ waitUntil: "domcontentloaded" });

await ctx.desktop.locator("#app-shell").waitFor();

await ctx.desktop.locator('#management-connection-status[data-status="connected"]').waitFor({ state: "visible" });

await ctx.desktop.waitForFunction((expected) => document.querySelector("#composer")?.disabled === false && document.querySelector("#composer")?.value === expected, editedReturnedDraft);

assert.equal(await ctx.desktop.locator("#composer").inputValue(), editedReturnedDraft, "persisted per-operation counts prevent historical snapshot returns from reappearing after draft edits and reload");

assert.equal(await ctx.desktop.locator(`.management-session-row[data-session-id=${JSON.stringify(ctx.sessionId)}]`).getAttribute("aria-current"), "true", "reload restores the matching recipient selection");

assert.equal(cancelSendRequests, 0, "restoration and reload never submit returned text automatically");

ctx.desktop.off("request", countCancelSend);

await ctx.desktop.locator('.pi-attachment-list button[data-action="remove-attachment"]').evaluateAll((buttons) => buttons.forEach((button) => button.click()));

await ctx.desktop.locator('.pi-reference-list button[data-action="remove-reference"]').evaluateAll((buttons) => buttons.forEach((button) => button.click()));

const toolProof = await ctx.sendUi(ctx.desktop, "NATIVE_TOOL_PROOF");

assert.equal(toolProof.accepted, true);

await ctx.waitForIdle(ctx.desktop, ctx.sessionId, toolProof.operationId);

await ctx.sendUi(ctx.desktop, "NATIVE_QUEUED_PROOF");

await ctx.waitForIdle(ctx.desktop, ctx.sessionId);

const pythonCard = ctx.desktop.locator('.pi-tool[data-tool-name="kernel_code"]').last();

const turnProcess = pythonCard.locator("xpath=ancestor::details[contains(concat(' ',normalize-space(@class),' '),' pi-turn-process ')][1]");

if (await turnProcess.count() && await turnProcess.getAttribute("open") === null) await turnProcess.locator(":scope > summary").click();

if (await pythonCard.getAttribute("open") === null) await pythonCard.locator(":scope > summary").click();

assert.equal(await pythonCard.locator('button[data-action="copy-code"]').count(), 0, "tool cards contain no copy controls");

assert.equal(await pythonCard.locator(".pi-message-actions").count(), 0, "tool cards carry no message toolbar");

const replyMessage = ctx.desktop.locator(".pi-message-assistant").filter({ hasText: "NATIVE_QUEUED_DONE" }).last();

await replyMessage.hover();

const replyActions = replyMessage.locator(".pi-message-actions");

const forkButton = replyActions.locator('button[data-action="fork-message"]');

assert.equal(await replyActions.locator('button[data-action="copy-message"]').count(), 1, "reply toolbar keeps copy");

assert.equal(await forkButton.count(), 1, "fork sits in the same reply toolbar as copy");

assert.equal(await ctx.desktop.locator(".pi-message-user [data-action='fork-message'], .pi-tool [data-action='fork-message']").count(), 0, "fork appears only on assistant replies");

await forkButton.waitFor({ state: "visible" });

assert.equal(await forkButton.isEnabled(), true, "an idle persisted reply can be forked");

const forkPending = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && response.request().postDataJSON()?.action === "fork-reply");

await forkButton.click();

const forkResponse = await forkPending;

assert.equal(forkResponse.status(), 200, "fork-reply request");

const forkResult = await ctx.readJsonResponse(forkResponse);

assert.equal(forkResult.status, "completed", "fork-reply completes");

const forkSessionId = forkResult.data?.session?.sessionId;

assert.ok(forkSessionId, "fork returns its native session identity");

await ctx.desktop.waitForFunction((name) => document.querySelector(`[data-session-id=${JSON.stringify(name)}]`)?.getAttribute("aria-current") === "true", forkSessionId);

await ctx.desktop.locator(".pi-message-assistant").filter({ hasText: "NATIVE_QUEUED_DONE" }).last().waitFor({ state: "visible" });

assert.equal(await ctx.desktop.locator(".pi-message-assistant [data-action='retry-message'], .pi-message-assistant [data-action='edit-message']").count(), 0, "rerun controls appear only on user messages");

const checkFirstRerunnable = async () => {
    const firstUser = ctx.desktop.locator(".pi-message-user").filter({ has: ctx.desktop.locator('[data-action="edit-message"]') }).first();
    const hasEarlierReply = await firstUser.evaluate((node) => [...document.querySelectorAll(".pi-message-assistant .pi-message-fork")]
      .some((fork) => fork.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
    await firstUser.hover();
    await firstUser.locator('[data-action="edit-message"]').click();
    const dialog = ctx.desktop.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    assert.equal(await dialog.locator('[data-action="fork"]').isDisabled(), !hasEarlierReply, "fork-to-new needs an earlier reply");
    await dialog.locator('[data-action="cancel"]').click();
    await dialog.waitFor({ state: "detached" });
    return hasEarlierReply;
  };

const forkHadEarlierReply = await checkFirstRerunnable();

await ctx.selectSession(ctx.desktop, ctx.main);

const mainHadEarlierReply = await checkFirstRerunnable();

assert.ok(!forkHadEarlierReply || !mainHadEarlierReply, "at least one first message exercises the disabled fork option");

await ctx.selectSession(ctx.desktop, forkSessionId);

let rerunDialog;

const queuedProof = () => ctx.desktop.locator(".pi-message-user").filter({ hasText: "NATIVE_QUEUED_PROOF" }).last();

await queuedProof().hover();

await queuedProof().locator('[data-action="edit-message"]').click();

rerunDialog = ctx.desktop.getByRole("dialog");

await rerunDialog.waitFor({ state: "visible" });

await rerunDialog.locator("#kernel-rollback-warning").waitFor({ state: "visible" });

const editForkPending = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && response.request().postDataJSON()?.action === "fork-reply");

await rerunDialog.locator('[data-action="fork"]').click();

const editFork = await ctx.readJsonResponse(await editForkPending);

assert.equal(editFork.status, "completed", "edit fork completes");

}
