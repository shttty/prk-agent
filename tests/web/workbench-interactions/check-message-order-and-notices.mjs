// Shift+Enter remains a line break; real Chromium IME coverage lives in native web.
// The browser really received the Gateway's streamed SDK events.
// A second real browser client observes the same identity without creating one.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export async function checkMessageOrderAndNotices(ctx) {
Object.defineProperties(ctx, {
    file: { configurable: true, get: () => file },
    firstSession: { configurable: true, get: () => firstSession },
    firstKernel: { configurable: true, get: () => firstKernel },
    drawer: { configurable: true, get: () => drawer },
});

await ctx.directoryPicker.waitFor({ state: "visible" });

await ctx.wait(async () => (await ctx.directoryPicker.locator(".management-directory-path").getAttribute("data-path")) === ctx.workbenchTempRoot, "picker starts in, and shows, the typed absolute cwd");

await ctx.directoryPicker.locator('[data-action="directory-back"]').click();

await ctx.directoryPicker.waitFor({ state: "hidden" });

await ctx.page.setViewportSize({ width: 1440, height: 1000 });

await ctx.page.keyboard.press("Escape");

await ctx.page.getByRole("dialog").waitFor({ state: "hidden" });

await ctx.manageButton.focus();

await ctx.manageButton.click();

await ctx.page.locator("#add-target").click();

await ctx.page.locator("#target-label").fill("手工实例失败重试");

await ctx.page.locator("#target-local").check({ force: true });

await ctx.page.route("**/api/targets/inspect", async (route) => { await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "fixture inspect failure", code: "TARGET_UNREACHABLE" }) }); }, { times: 1 });

const failureResponse = ctx.page.waitForResponse((response) => response.url().endsWith("/api/targets/inspect") && response.request().method() === "POST");

await ctx.inspectionButton.click();

assert.equal((await failureResponse).status(), 503);

await ctx.wait(async () => (await ctx.inspectionFeedback.getAttribute("data-state")) === "error" && (await ctx.inspectionFeedback.textContent()).includes("fixture inspect failure"), "failed inspect response is shown");

assert.equal(await ctx.inspectionFeedback.getAttribute("role"), "alert", "Inspection failure is announced as an alert");

assert.equal(await ctx.inspectionFeedback.getAttribute("data-code"), "TARGET_UNREACHABLE", "The failure is told by its code");

const retryResponse = ctx.page.waitForResponse((response) => response.url().endsWith("/api/targets/inspect") && response.request().method() === "POST");

await ctx.inspectionButton.click();

await retryResponse;

await ctx.wait(async () => (await ctx.inspectionFeedback.getAttribute("data-state")) === "success", "inspection retry success feedback");

assert.deepEqual(await ctx.ids(), ctx.beforeInspection, "Repeated inspection success/failure/retry leaves probe kernels cleaned");

assert.deepEqual(ctx.host.workbench().sessions, [], "Connection inspection creates no user worker");

await ctx.page.locator("#target-local").uncheck({ force: true });

await ctx.page.locator("#target-ssh-command").fill("SSHPASS=fixture-modal-secret-never-stored sshpass -e ssh -T -oBatchMode=yes fixture@127.0.0.1 -p 1");

assert.equal(await ctx.inspectionFeedback.count(), 0, "A changed connection drops the earlier test result");

await ctx.page.route("**/api/targets/inspect", async (route) => { await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "fixture changed-connection failure", code: "TARGET_UNREACHABLE" }) }); }, { times: 1 });

const changedFailureResponse = ctx.page.waitForResponse((response) => response.url().endsWith("/api/targets/inspect") && response.request().method() === "POST");

await ctx.inspectionButton.click();

assert.equal((await changedFailureResponse).status(), 503);

await ctx.wait(async () => (await ctx.inspectionFeedback.getAttribute("data-state")) === "error" && (await ctx.inspectionFeedback.textContent()).includes("fixture changed-connection failure"), "changed connection failure feedback");

await ctx.page.locator("#save-target").click();

await ctx.page.locator("#target-editor-error").waitFor({ state: "visible" });

await ctx.page.keyboard.press("Escape");

await ctx.page.getByRole("dialog").waitFor({ state: "hidden" });

await ctx.wait(async () => ctx.manageButton.evaluate((node) => document.activeElement === node), "Closing settings restores keyboard focus", 2_000);

await ctx.manageButton.click();

await ctx.page.locator("#add-target").click();

await ctx.page.keyboard.press("Escape");

assert.equal(await ctx.page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]).includes("fixture-modal-secret-never-stored")), false, "The connection command is never written to browser storage");

if (process.env.PI_TEST_WEB_HOST) {
    assert.equal(await ctx.page.evaluate(() => location.hostname), ctx.webHost);
    assert.equal(await ctx.page.evaluate(() => isSecureContext), false, "Private-interface HTTP must be an insecure browser context");
    assert.equal(await ctx.page.evaluate(() => navigator.clipboard), undefined, "Insecure HTTP must not expose secure clipboard");
  }

await ctx.assertNoSession();

assert.equal(await ctx.page.locator(".management-session-row").count(), 0, "Configured instances are not phantom conversations");

assert.equal(await ctx.configuredInstanceGroups().count(), 1, "Each configured instance renders one independent branch");

await ctx.createSession("alpha", "first", { label: "主会话", cwd: "session-one" });

assert.equal(ctx.snapshot("first").kernel.state, "not_started");

assert.deepEqual(await ctx.ids(), ctx.sentinelIds, "Creating a session stays lazy about kernels");

await ctx.page.screenshot({ path: join(ctx.evidence, "desktop-empty.png"), fullPage: true, animations: "disabled" });

await ctx.page.locator("#composer").fill("draft");

await ctx.page.locator("#composer").press("Shift+Enter");

assert.match(await ctx.page.locator("#composer").inputValue(), /\n/);

const file = join(ctx.root, "value.txt");

const firstCode = `from pathlib import Path\nassert str(Path.cwd()) == ${JSON.stringify(join(ctx.workbenchTempRoot, "session-one"))}\nsession_value = 41\nPath(${JSON.stringify(file)}).write_text(str(session_value))\nprint('value=', session_value, flush=True)\nprint('<img src=x onerror=alert(1)>')`;

await ctx.runHere("first", firstCode, "value= 41");

const userMessage = ctx.page.locator("#messages .user .markdown").first();

assert.equal(await ctx.page.locator("#messages .assistant .pi-user-expand").count(), 0, "Assistant messages are never user-collapsed");

assert.equal(await userMessage.locator("pre code").textContent(), `${firstCode}\n`, "User code fences preserve the exact literal source");

assert.equal(await userMessage.locator("script, img, [onerror], a[href^='javascript:'], .evil, [class='evil']").count(), 0, "User Markdown cannot introduce executable content or arbitrary classes");

assert.match(await userMessage.textContent(), /raw user HTML/);

assert.deepEqual(await ctx.page.locator("#messages .user, #messages .tool-call, #messages .assistant .markdown").evaluateAll((nodes) => nodes.map((node) => node.matches(".tool-call") ? "tool" : node.matches(".user") ? "user" : "assistant")), ["user", "tool", "assistant"], "Call and its result appear before their answer, not in a detached feed");

await ctx.browserNetwork.detach();

assert(ctx.delivered.some((event) => event.type === "message" && event.text), "Browser receives actual assistant deltas");

assert(ctx.delivered.some((event) => event.details?.sdkType === "tool_execution_start" && event.details.args?.code?.includes("session_value = 41")), "Browser receives the real Python code in tool_execution_start args");

assert(ctx.delivered.some((event) => event.details?.sdkType === "tool_execution_update" && event.details.partialResult), "Browser receives live partial Python output");

assert.equal(await ctx.page.locator("#messages img, #activity-feed img").count(), 0, "Conversation Markdown and literal tool output cannot introduce images");

const markdown = ctx.page.locator("#messages .assistant .markdown").last();

assert.equal(await markdown.locator("script, img, [onerror], a[href^='javascript:']").count(), 0, "Markdown cannot introduce executable content");

const safeLink = markdown.getByRole("link", { name: "安全链接", exact: true });

assert.equal(new URL(await safeLink.getAttribute("href")).origin, "https://example.com");

assert.equal(await safeLink.getAttribute("rel"), "noopener noreferrer");

assert.equal(await readFile(file, "utf8"), "41");

const firstTool = ctx.page.locator(".tool-call").filter({ hasText: "value= 41" }).first();

const firstToolResult = ctx.snapshot("first").messages.find((message) => message.role === "toolResult" && message.toolName === "kernel_code");

const expectedRawOutput = firstToolResult.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");

assert(expectedRawOutput.startsWith("value= 41\n<img src=x onerror=alert(1)>\n"), "The unified tool preserves stdout before its kernel variable summary");

assert.equal(await firstTool.locator(".output-block").textContent(), expectedRawOutput, "The complete real kernel_code result remains exact raw text");

assert.equal(await firstTool.locator(".code-block").textContent(), firstCode);

const copyExpected = `${firstCode}\n`;

const displayedDurationMs = Number(await firstTool.locator(".tool-duration").getAttribute("data-duration-ms"));

assert(Number.isFinite(displayedDurationMs) && displayedDurationMs > 0, "Python duration is a live numeric value");

const clipboardState = async (currentPage) => currentPage.evaluate(() => ({
    available: typeof navigator.clipboard?.writeText === "function" && typeof navigator.clipboard?.readText === "function",
  }));

const assertCopySuccess = async (currentPage, button, feedback, expected, label) => {
    const browserClipboard = await clipboardState(currentPage);
    assert.equal(browserClipboard.available, true, `${label} requires the standard browser Clipboard API`);
    await button.click();
    await feedback.waitFor({ state: "visible" });
    assert.equal(await feedback.getAttribute("data-state"), "success", `${label} reports copy success`);
    assert.equal(await currentPage.evaluate(() => document.activeElement?.classList.contains("code-copy")), true, `${label} keeps focus on the copy control`);
    await ctx.wait(async () => (await currentPage.evaluate(() => navigator.clipboard.readText())) === expected, `${label} clipboard write`);
    assert.equal(await currentPage.evaluate(() => navigator.clipboard.readText()), expected, `${label} writes exact text to the real browser clipboard`);
    return browserClipboard;
  };

const assertCopyFailure = async (currentPage, button, feedback, label) => {
    await feedback.waitFor({ state: "hidden" });
    await button.click();
    await ctx.wait(async () => (await feedback.getAttribute("data-state")) === "failure", `${label} exposes the actual browser copy failure`);
    assert.equal(await feedback.getAttribute("data-state"), "failure", `${label} exposes the actual browser copy failure`);
  };

const copyButton = userMessage.locator(".code-copy").first();

await copyButton.waitFor({ state: "visible" });

const copyFeedback = userMessage.locator(".code-copy-feedback");

const desktopClipboard = await clipboardState(ctx.page);

if (desktopClipboard.available) await assertCopySuccess(ctx.page, copyButton, copyFeedback, copyExpected, "desktop code copy");
  else await assertCopyFailure(ctx.page, copyButton, copyFeedback, "desktop code copy");

await ctx.page.locator("#theme-toggle").click();

assert.equal(await copyButton.isVisible(), true, "Copy control remains visible after a real application rerender");

const firstSession = ctx.snapshot("first").sessionId;

const firstKernel = ctx.snapshot("first").kernel.kernelId;

assert(firstKernel);

assert.equal((await ctx.sessionKernels("session-one")).length, 1, "The first session's REPL is a live process in its own cwd");

await ctx.noOverflow(ctx.page);

await ctx.page.screenshot({ path: join(ctx.evidence, "desktop-chat.png"), fullPage: true, animations: "disabled" });

ctx.mobile = await ctx.browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

ctx.phone = await ctx.mobile.newPage();

ctx.watchErrors(ctx.phone);

await ctx.phone.goto(ctx.ui.url);

await ctx.phone.locator("#open-sidebar").waitFor({ state: "visible" });

assert.equal(await ctx.phone.locator(".management-sidebar").isVisible(), false);

await ctx.phone.locator("#open-sidebar").click();

const drawer = ctx.phone.getByRole("dialog");

await drawer.waitFor();

await ctx.phone.keyboard.press("Shift+Tab");

}
