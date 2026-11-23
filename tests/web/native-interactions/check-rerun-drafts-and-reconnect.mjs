// 从这里重来 → 在当前会话里: this session backs up to before the message and resends it once.
// Coordination sessions use the same target file-reference path as every worker.
// Draft persistence survives session switching and browser return on the same Web origin.
// One phone-width touch flow; desktop owns the full control coverage.
// Stop only the disposable Web adapter; the Gateway and its tasks stay alive.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function checkRerunDraftsAndReconnect(ctx) {
const editForkName = ctx.editFork.data?.session?.sessionId;

assert.ok(editForkName && editForkName !== ctx.forkSessionId, "edit fork opens another session");

await ctx.desktop.waitForFunction((name) => document.querySelector(`[data-session-id=${JSON.stringify(name)}]`)?.getAttribute("aria-current") === "true", editForkName);

await ctx.desktop.waitForFunction(() => document.querySelector("#composer")?.value === "NATIVE_QUEUED_PROOF");

await ctx.desktop.locator(".pi-message-assistant").filter({ hasText: "NATIVE_TOOL_DONE" }).last().waitFor({ state: "visible" });

assert.equal(await ctx.desktop.locator(".pi-message-user").filter({ hasText: "NATIVE_QUEUED_PROOF" }).count(), 0, "the fork stops before the edited message");

await ctx.desktop.locator("#composer").fill("");

await ctx.selectSession(ctx.desktop, ctx.forkSessionId);

await ctx.queuedProof().hover();

const backUpPending = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && response.request().postDataJSON()?.action === "tree");

const resendPending = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/send"));

await ctx.queuedProof().locator('[data-action="retry-message"]').click();

assert.equal((await ctx.readJsonResponse(await backUpPending)).status, "completed", "in-place rerun backs up the session");

const resend = await resendPending;

assert.equal(resend.request().postDataJSON()?.message, "NATIVE_QUEUED_PROOF", "retry resends the original text");

await ctx.waitForIdle(ctx.desktop, ctx.forkSessionId);

await ctx.desktop.locator(".pi-message-assistant").filter({ hasText: "NATIVE_QUEUED_DONE" }).last().waitFor({ state: "visible" });

assert.equal(await ctx.desktop.locator(".pi-message-user").filter({ hasText: "NATIVE_QUEUED_PROOF" }).count(), 1, "the abandoned continuation is not shown next to the rerun");

assert.equal(await ctx.desktop.locator("#composer").inputValue(), "", "retry leaves the composer empty");

await ctx.selectSession(ctx.desktop, ctx.sourceSessionId);

ctx.sessionId = ctx.sourceSessionId;

await ctx.selectSession(ctx.desktop, ctx.main);

await ctx.desktop.locator("#composer").fill("@fixture.py");

const coordinatorReference = ctx.desktop.locator(`#native-reference-list [data-path=${JSON.stringify(join(ctx.tempRoot, "fixture.py"))}]`);

await coordinatorReference.waitFor({ state: "visible" });

assert.equal(await coordinatorReference.getAttribute("aria-disabled"), null, "A coordinator worker can reference its target files");

const referenceCount = await ctx.desktop.locator('.pi-reference-list [data-action="remove-reference"]').count();

await coordinatorReference.click();

assert.equal(await ctx.desktop.locator('.pi-reference-list [data-action="remove-reference"]').count(), referenceCount + 1);

await ctx.desktop.locator('.pi-reference-list [data-action="remove-reference"]').last().click();

await ctx.selectSession(ctx.desktop, ctx.sessionId);

await ctx.desktop.locator("#composer").fill("persisted draft");

await ctx.selectSession(ctx.desktop, ctx.main);

await ctx.selectSession(ctx.desktop, ctx.sessionId);

assert.equal(await ctx.desktop.locator("#composer").inputValue(), "persisted draft", "draft is keyed by native sessionId");

await ctx.desktop.reload({ waitUntil: "domcontentloaded" });

await ctx.desktop.locator("#app-shell").waitFor();

await ctx.selectSession(ctx.desktop, ctx.sessionId);

assert.equal(await ctx.desktop.locator("#composer").inputValue(), "persisted draft", "draft survives browser return");

await ctx.selectSession(ctx.phone, ctx.sessionId, true);

await ctx.phone.locator("#composer").fill("touch busy proof");

const phoneBusy = await ctx.sendUi(ctx.phone, "touch busy proof", true);

assert.equal(phoneBusy.accepted, true);

const busyImeProof = await ctx.checkComposingEnter(ctx.phone, ctx.sessionId, "busy IME", "busy");

await ctx.phone.locator("#cancel-operation").tap();

await ctx.waitForOperationCompletion(ctx.phone, ctx.sessionId, phoneBusy.operationId);

await ctx.phone.screenshot({ path: join(ctx.evidence, "phone-chat.png"), animations: "disabled" });

const modelCallsBeforeReconnect = ctx.modelCalls;

await ctx.selectSession(ctx.desktop, ctx.sessionId);

const messagesBeforeReconnect = (await ctx.state(ctx.desktop, ctx.sessionId)).messages;

const reconnectDraft = "draft retained across a real display outage";

await ctx.desktop.locator("#composer").fill(reconnectDraft);

let recoverySendRequests = 0;

const countRecoverySend = (request) => { if (request.method() === "POST" && new URL(request.url()).pathname === `/api/sessions/${ctx.sessionId}/send`) recoverySendRequests++; };

ctx.desktop.on("request", countRecoverySend);

await ctx.web.close();

ctx.web = undefined;

await ctx.desktop.locator('#management-connection-status[data-status="connecting"]').waitFor({ state: "visible" });

await ctx.desktop.locator("#composer").press("Enter");

await ctx.desktop.locator("#chat-error").waitFor({ state: "visible" });

assert.equal(await ctx.desktop.locator("#composer").inputValue(), reconnectDraft, "failed connection recovery keeps the new draft");

assert.equal(recoverySendRequests, 0, "failed pre-send recovery never attempts a POST");

assert.equal(await ctx.desktop.locator('.pi-chat [role="menuitem"]').count(), 0, "a disconnected chat exposes no menu actions");

ctx.web = await ctx.startWebApplication({ socket: ctx.socket, host: "127.0.0.1", port: ctx.apiPort });

await ctx.desktop.locator('#management-connection-status[data-status="connected"]').waitFor({ state: "visible", timeout: 15_000 });

assert.equal(await ctx.desktop.locator("#composer").inputValue(), reconnectDraft, "native SSE recovery preserves the current draft");

assert.equal(await ctx.desktop.locator(`.management-session-row[data-session-id=${JSON.stringify(ctx.sessionId)}]`).getAttribute("aria-current"), "true", "automatic recovery keeps routing selection");

assert.equal((await ctx.state(ctx.desktop, ctx.sessionId)).sessionId, ctx.initialSessionId);

assert.deepEqual((await ctx.state(ctx.desktop, ctx.sessionId)).messages, messagesBeforeReconnect, "connection recovery does not replay a task");

assert.equal(ctx.modelCalls, modelCallsBeforeReconnect);

const recoveredSend = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/sessions/${ctx.sessionId}/send`);

await ctx.desktop.locator("#composer").press("Enter");

const recoveredAdmission = await ctx.readJsonResponse(await recoveredSend);

assert.equal(recoveredAdmission.accepted, true);

await ctx.waitForIdle(ctx.desktop, ctx.sessionId, recoveredAdmission.operationId);

assert.equal(recoverySendRequests, 1, "one new send after outage has exactly one admission request");

ctx.desktop.off("request", countRecoverySend);

const manifest = {
    status: "PASS",
    evidenceDir: ctx.evidence,
    sessionIdentities: { main: ctx.main, initial: ctx.initialSessionId, clone: ctx.cloneSessionId, fork: ctx.forkSessionId },
    imeProof: [ctx.idleImeProof, busyImeProof],
    sourceReferences: ["fixture.py", "folder/nested/fixture.txt", "fixture.js"],
    origins: { ui: ctx.ui.url, api: ctx.web.server.url },
    touchWidth: 390,
  };

await writeFile(join(ctx.evidence, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify(manifest));

console.log(`Native Web evidence directory: ${ctx.evidence}`);
}
