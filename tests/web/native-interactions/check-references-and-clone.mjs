// Export lives in the sidebar row menu and downloads through the browser.
// Usage lives behind the context ring under the composer; it reads SDK stats without a chat card.
// /clone creates an independent worker from the active branch; the source keeps its runtime.
// Clone lives in the sidebar row menu ("复制为新会话").
// Leading whitespace uses the same slash normalization as the Gateway and still offers explicit plain text.
// Queue controls return pending text to the draft; backend admission/cancel semantics live in session-host.
// Leave new SDK steer/follow-up residue for cancel itself, including legitimate duplicate texts.
import assert from "node:assert/strict";
import { checkWebNewCommand } from "./check-web-new-command.mjs";

export async function checkReferencesAndClone(ctx) {
Object.defineProperties(ctx, {
    sessionId: { configurable: true, get: () => sessionId, set: (value) => { sessionId = value; } },
    initialSessionId: { configurable: true, get: () => initialSessionId },
    sourceSessionId: { configurable: true, get: () => sourceSessionId },
    cloneSessionId: { configurable: true, get: () => cloneSessionId },
    idleImeProof: { configurable: true, get: () => idleImeProof },
    cancelRetainedDraft: { configurable: true, get: () => cancelRetainedDraft },
    cancelSteerText: { configurable: true, get: () => cancelSteerText },
    cancelFollowText: { configurable: true, get: () => cancelFollowText },
    cancelRepeatedText: { configurable: true, get: () => cancelRepeatedText },
});

for (const expectedCount of [1, 2]) {
    await ctx.desktop.locator("#composer").fill(ctx.repeatedText);
    const sent = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/sessions/${ctx.main}/send`);
    await ctx.desktop.locator("#composer").press("Enter");
    const admission = await ctx.readJsonResponse(await sent);
    assert.equal(admission.accepted, true);
    await ctx.desktop.waitForFunction((expected) => document.querySelectorAll(".pi-message-user").length >= expected, expectedCount);
    assert.equal(await ctx.desktop.locator(".pi-message-user").count(), expectedCount, "one user bubble per admitted Enter while streaming");
    await ctx.waitForIdle(ctx.desktop, ctx.main, admission.operationId);
    assert.equal(await ctx.desktop.locator(".pi-message-user").count(), expectedCount, "intentional identical sends remain separate, not duplicated");
    assert.equal((await ctx.state(ctx.desktop, ctx.main)).messages.filter((message) => message.role === "user").length, expectedCount);
    assert.equal(ctx.repeatedRequests, expectedCount, "Enter performs exactly one send request");
  }

ctx.desktop.off("request", ctx.countRepeatedSend);
await checkWebNewCommand(ctx);

const sessionResponse = await ctx.api(ctx.desktop, "/api/sessions", { method: "POST", body: ctx.json({ target: ctx.target.id, label: "Native worker fixture" }) });

assert.equal(sessionResponse.status, 201, "worker fixture setup");

let sessionId = sessionResponse.body.session.sessionId;

assert.equal(typeof sessionId, "string");

const initialSessionId = sessionResponse.body.session.sessionId;

await ctx.selectSession(ctx.desktop, sessionId);

await ctx.desktop.locator("#composer").fill("/");

const commandList = ctx.desktop.locator("#native-candidate-list");

await commandList.waitFor({ state: "visible" });

const listed = await commandList.locator(".pi-command-name").allTextContents();

assert.ok(listed.includes("/compact"), "/compact is listed");

for (const name of ["/model", "/login"]) assert.ok(!listed.includes(name), `${name} is not listed: it has its own control or no Web use`);

await ctx.chooseCommand(ctx.desktop, "compact");

assert.match(await ctx.desktop.locator("#composer").inputValue(), /^\/compact\s+$/, "command selection only fills the composer");

const exportDownload = ctx.desktop.waitForEvent("download");

const exportPending = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && response.request().postDataJSON()?.action === "export");

await ctx.chooseSessionMenuItem(ctx.desktop, "export-jsonl");

const exportResponse = await ctx.readJsonResponse(await exportPending);

assert.equal(exportResponse.status, "completed", "row-menu export completes");

assert.equal((await exportPending).request().postDataJSON()?.args?.format, "jsonl", "row-menu export asks for the chosen format");

assert.match((await exportDownload).suggestedFilename(), /\.jsonl$/, "row-menu export downloads a JSONL file");

await ctx.desktop.locator("#composer").fill("");

await ctx.desktop.locator("#composer").fill("@fixture.py");

await ctx.chooseReference(ctx.desktop, "fixture.py");

const firstReference = ctx.desktop.locator(".pi-reference-list [title*='fixture.py']");

await firstReference.waitFor({ state: "visible" });

await ctx.desktop.locator("#composer").fill("@folder/nested/");

await ctx.chooseReference(ctx.desktop, "fixture.txt");

assert.equal(await ctx.desktop.locator(".pi-reference-list [title*='fixture.py']").count(), 1, "final source references retain fixture.py");

assert.equal(await ctx.desktop.locator(".pi-reference-list [title*='fixture.txt']").count(), 1, "final source references retain folder/nested/fixture.txt");

await ctx.desktop.locator("#composer").fill("@fixture.js");

await ctx.chooseReference(ctx.desktop, "fixture.js");

await ctx.desktop.locator("input[type=file]").setInputFiles([{ name: "pixel.png", mimeType: "image/png", buffer: ctx.PNG_1X1 }, { name: "upload.py", mimeType: "text/x-python", buffer: Buffer.from("PYTHON_UPLOAD_SENTINEL = 43\n") }]);

await ctx.expectVisible(ctx.desktop, "#composer-add");

assert.ok(await ctx.desktop.locator(".pi-attachment-list").isVisible(), "browser attachment is visible before send");

const sourceResponse = await ctx.sendUi(ctx.desktop, "source proof");

assert.equal(sourceResponse.accepted, true, "source proof was admitted by the SDK");

await ctx.expectVisible(ctx.desktop, "#operation-bar");

await ctx.waitForIdle(ctx.desktop, sessionId, sourceResponse.operationId);

const sourceHistory = (await ctx.api(ctx.desktop, `/api/sessions/${encodeURIComponent(sessionId)}/history`)).body;

const sourceJson = JSON.stringify(sourceHistory);

assert.match(sourceJson, /ROOT_SENTINEL/);

assert.match(sourceJson, /NESTED_SENTINEL/);

assert.match(sourceJson, /JAVASCRIPT_SENTINEL/);

assert.match(sourceJson, /PYTHON_UPLOAD_SENTINEL/);

const sourceMessage = ctx.desktop.locator("#messages .pi-message-user").filter({ hasText: "source proof" }).last();

await sourceMessage.locator("img").first().waitFor({ state: "visible" });

assert.equal(await sourceMessage.locator("img").count(), 1, "the SDK image content renders in the user message");

const cardsBeforeUsage = await ctx.desktop.locator(".pi-native-interaction-card").count();

const usagePending = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && response.request().postDataJSON()?.action === "session");

await ctx.desktop.locator("#context-usage").click();

const usageRead = await ctx.readJsonResponse(await usagePending);

assert.equal(usageRead.status, "completed");

const usagePanel = ctx.desktop.locator("#context-usage-dropdown");

await usagePanel.locator('[data-metric="cumulative-tokens"]').waitFor({ state: "visible" });

assert.ok(Number.isFinite(usageRead.data?.tokens?.total), "SDK reports cumulative tokens");

assert.ok((await usagePanel.innerText()).includes(usageRead.data.tokens.total.toLocaleString("zh-CN")), "usage panel shows the SDK token total");

assert.equal(await usagePanel.locator('[data-metric-value="messages"]').getAttribute("data-count"), String(usageRead.data.totalMessages), "usage panel shows the SDK message count");

await ctx.desktop.keyboard.press("Escape");

await usagePanel.waitFor({ state: "hidden" });

assert.equal(await ctx.desktop.locator(".pi-native-interaction-card").count(), cardsBeforeUsage, "usage panel adds no chat card");

const sourceSessionId = sessionId;


const clonePending = ctx.desktop.waitForResponse((response) => response.request().method() === "POST" && response.request().postDataJSON()?.action === "clone");

await ctx.chooseSessionMenuItem(ctx.desktop, "clone-session");

const cloneResponse = await ctx.readJsonResponse(await clonePending);

assert.equal(cloneResponse.status, "completed");

const cloneSessionId = cloneResponse.data?.session?.sessionId;

assert.ok(cloneSessionId, "clone returns its native session identity");

sessionId = cloneSessionId;

await ctx.selectSession(ctx.desktop, sessionId, false, true);

await ctx.recoverWithNewKernel(ctx.desktop, sessionId);

await ctx.selectSession(ctx.desktop, sourceSessionId);

sessionId = sourceSessionId;

const escapedPlainText = "  /unknown-native-command";

await ctx.desktop.locator("#composer").fill(escapedPlainText);

await ctx.desktop.locator("#send-as-plain").click();

assert.equal(await ctx.desktop.locator("#composer").inputValue(), escapedPlainText);

const idleImeProof = await ctx.checkComposingEnter(ctx.desktop, sessionId, escapedPlainText, "idle");

const plainResponse = await ctx.sendUi(ctx.desktop, escapedPlainText);

assert.equal(plainResponse.accepted, true, "plain-text escape sends ordinary text");

const plainOperation = await ctx.waitForRunning(ctx.desktop, sessionId);

await ctx.waitForIdle(ctx.desktop, sessionId, plainOperation?.operationId);

const preservedSearchDraft = "do not send this while finding";

await ctx.desktop.locator("#composer").fill(preservedSearchDraft);

let searchSendRequests = 0;

const countSearchSend = (request) => { if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/send")) searchSendRequests++; };

ctx.desktop.on("request", countSearchSend);

await ctx.desktop.locator("#composer-add").click();

await ctx.desktop.locator("#find-current-page").click();

const searchInput = ctx.desktop.locator("#transcript-search");

await searchInput.fill("Controlled");

await searchInput.press("Enter");

await searchInput.press("Shift+Enter");

await searchInput.press("Escape");

await searchInput.waitFor({ state: "hidden" });

assert.equal(await ctx.desktop.locator("#composer").inputValue(), preservedSearchDraft);

assert.equal(await ctx.desktop.evaluate(() => document.activeElement?.id), "composer", "closing search restores composer focus");

assert.equal(searchSendRequests, 0, "searching never submits an ordinary message");

ctx.desktop.off("request", countSearchSend);

await ctx.sendUi(ctx.desktop, "ordinary cancellation branch");

await ctx.waitForRunning(ctx.desktop, sessionId);

await ctx.setQueue(ctx.desktop, "steer");

await ctx.sendUi(ctx.desktop, "steer sentinel");

await ctx.setQueue(ctx.desktop, "followUp");

await ctx.sendUi(ctx.desktop, "follow sentinel");

const retainedDraft = "keep my existing draft";

await ctx.desktop.locator("#composer").fill(retainedDraft);

await ctx.desktop.locator("#restore-queued-messages").click();

await ctx.desktop.waitForFunction(() => document.querySelector("#composer")?.value.includes("follow sentinel"));

assert.ok((await ctx.desktop.locator("#composer").inputValue()).startsWith(retainedDraft), "withdrawing pending text never overwrites an existing draft");

await ctx.desktop.locator("#restore-queued-messages").waitFor({ state: "hidden" });

const cancelRetainedDraft = await ctx.desktop.locator("#composer").inputValue();

const cancelSteerText = "cancel steer sentinel";

const cancelFollowText = "cancel follow sentinel";

const cancelRepeatedText = "cancel repeated sentinel";

}
