// Long real output: no inner scroll; the card shows the first lines and a growing hidden-line count while streaming.
// Observation is detachable: the Gateway keeps executing while no browser looks.
// Cancellation from the browser, then safe reuse of the same kernel.
// An unobserved send remains unknown across reconnect and is never replayed.
// Without a Gateway answer the browser only knows the send is unknown; it never retries.
// A Gateway refusal that says "not submitted" (no kernel could be brought back) is shown as a definite failure
  // with its reason, not as an unknown send; the draft stays.
// Banners float: when one appears the transcript and composer keep their exact box, and the banner sits inside the chat column, above the composer, and takes clicks.
// A session-level error shows once, inside the session banner (headline, reason, retry), not in a second box in the chat.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export async function checkKernelAndAttachments(ctx) {
Object.defineProperties(ctx, {
    secondSession: { configurable: true, get: () => secondSession },
});

assert(await ctx.drawer.evaluate((node) => node.contains(document.activeElement)), "Phone sidebar traps backward keyboard focus");

await ctx.phone.keyboard.press("Tab");

assert(await ctx.drawer.evaluate((node) => node.contains(document.activeElement)), "Phone sidebar traps forward keyboard focus");

await ctx.phone.keyboard.press("Escape");

await ctx.drawer.waitFor({ state: "hidden" });

assert.equal(await ctx.phone.evaluate(() => document.activeElement.id), "open-sidebar");

await ctx.phone.locator("#open-sidebar").click();

await ctx.selectSessionOn(ctx.phone, "first");

await ctx.visibleText("value= 41", ctx.phone);

const phoneFirstUser = ctx.phone.locator("#messages .user").first();

const phoneFirstExpand = phoneFirstUser.locator(".pi-user-expand");

await phoneFirstExpand.click();

assert(await phoneFirstUser.locator(".pi-user-message-content").evaluate((node) => node.classList.contains("is-expanded")), "Touch users can expand the full long message");

await ctx.phone.screenshot({ path: join(ctx.evidence, "phone-long-user-expanded.png"), fullPage: true, animations: "disabled" });

await phoneFirstExpand.click();

const emptyComposer = await ctx.phone.locator("#composer").evaluate((node) => { const rect = node.closest(".pi-composer")?.getBoundingClientRect() || node.getBoundingClientRect(); return { height: rect.height, overflowY: getComputedStyle(node).overflowY }; });

assert(emptyComposer.height <= 100, `Empty phone composer stays compact (${emptyComposer.height}px)`);

await ctx.phone.locator("#composer").fill(Array.from({ length: 24 }, (_, index) => `phone-line-${index}`).join("\n"));

const multilineComposer = await ctx.phone.locator("#composer").evaluate((node) => ({ height: node.getBoundingClientRect().height, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, maxHeight: getComputedStyle(node).maxHeight, overflowY: getComputedStyle(node).overflowY }));

assert(multilineComposer.height <= 160 + 2, `Multiline composer respects the 160px CSS cap (${multilineComposer.height}px)`);

assert(multilineComposer.scrollHeight > multilineComposer.clientHeight || multilineComposer.overflowY === "auto", "Multiline composer keeps internal scrolling");

await ctx.phone.locator("#composer").fill("");

const historicalFirstTool = ctx.phone.locator(".tool-call").filter({ hasText: "value= 41" }).first();

assert.equal(await historicalFirstTool.locator(".tool-duration").getAttribute("data-duration-state"), "unavailable");

assert.equal(await historicalFirstTool.locator(".tool-status").getAttribute("data-state"), "done");

await ctx.noOverflow(ctx.phone);

await ctx.phone.screenshot({ path: join(ctx.evidence, "phone-chat.png"), fullPage: true, animations: "disabled" });

const longCount = ctx.snapshot("first").recentOperations.length;

await ctx.send("import time\nfor i in range(180):\n    print(f'ux-line-{i:03d}-' + 'x' * 100, flush=True)\n    time.sleep(0.06)\nprint('ux-output-end', flush=True)");

await ctx.liveOutput("ux-line-000-");

const longCard = ctx.page.locator("[data-tool-key]").filter({ hasText: "ux-line-000-" }).first();

const hiddenLines = async () => Number(await longCard.locator('[data-action="expand-lines"]').first().getAttribute("data-hidden-lines").catch(() => "0"));

await ctx.wait(async () => (await hiddenLines()) >= 40, "hidden count grows while streaming");

const hiddenWhileStreaming = await hiddenLines();

await ctx.wait(async () => (await hiddenLines()) > hiddenWhileStreaming, "hidden count keeps following the stream");

assert(await longCard.locator(".output-block").evaluate((node) => node.scrollHeight <= node.clientHeight + 1), "Streaming output has no inner scroll");

await ctx.wait(() => ctx.snapshot("first").recentOperations.length > longCount && !ctx.snapshot("first").operation, "long output terminal");

await ctx.visibleText("ux-line-000-");

assert(await hiddenLines() > 150, "Finished long output stays folded");

await longCard.locator('[data-action="expand-lines"]').first().click();

await ctx.visibleText("ux-output-end");

for (const surface of [ctx.page]) {
    await ctx.visibleText("ux-output-end", surface);
    const output = surface.locator("[data-tool-key] .output-block").filter({ hasText: "ux-line-179-" });
    assert(await output.evaluate((node) => node.scrollHeight <= node.clientHeight + 1), "Expanded long output grows the card instead of scrolling inside it");
    assert(await surface.locator("#composer").evaluate((node) => { const rect = node.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight; }), "Composer stays available while reading long tool output");
  }

await ctx.page.screenshot({ path: join(ctx.evidence, "desktop-long-output.png"), fullPage: true, animations: "disabled" });

await ctx.phone.screenshot({ path: join(ctx.evidence, "phone-long-output.png"), fullPage: true, animations: "disabled" });

const detachedCount = ctx.snapshot("first").recentOperations.length;

const detachedRelease = `${ctx.file}.detach-release`;
await ctx.send(`from pathlib import Path\nimport time\nprint('detached-start', flush=True)\ndeadline = time.monotonic() + 90\nwhile not Path(${JSON.stringify(detachedRelease)}).exists():\n    if time.monotonic() >= deadline: raise TimeoutError('detached release not received')\n    time.sleep(0.05)\nassert session_value == 41\nassert Path(${JSON.stringify(ctx.file)}).read_text() == '41'\nprint('detached-finished', session_value, flush=True)`);

await ctx.liveOutput("detached-start");

assert.equal(ctx.snapshot("first").kernel.state, "busy", "Live Python output must arrive before execution finishes");

await ctx.page.screenshot({ path: join(ctx.evidence, "desktop-live-output.png"), fullPage: true, animations: "disabled" });

const messagesBeforeReload = ctx.snapshot("first").messages.filter(({ role }) => role === "user").length;

await ctx.page.close();

assert.equal(ctx.snapshot("first").kernel.state, "busy", "Closing the page must not abort Python");

ctx.page = await ctx.desktop.newPage();

ctx.watchErrors(ctx.page);

await ctx.page.goto(ctx.ui.url);

await ctx.selectSession("first");

assert.equal(ctx.snapshot("first").kernel.state, "busy", "A reopened page observes the still-running Gateway-owned kernel");
await writeFile(detachedRelease, "release");

await ctx.wait(() => ctx.snapshot("first").recentOperations.length > detachedCount && !ctx.snapshot("first").operation, "detached execution completion");

await ctx.visibleText("detached-finished 41");

assert.equal(ctx.snapshot("first").sessionId, ctx.firstSession);

assert.equal(ctx.snapshot("first").kernel.kernelId, ctx.firstKernel);

assert.equal(ctx.snapshot("first").messages.filter(({ role }) => role === "user").length, messagesBeforeReload, "Reconnect must not replay a send");

const cancelCount = ctx.snapshot("first").recentOperations.length;

await ctx.send("print('cancel-start', flush=True)\nimport time\ntime.sleep(30)\nprint('must-not-finish')");

await ctx.liveOutput("cancel-start");

await ctx.page.locator("#cancel-operation").click();

await ctx.wait(() => ctx.snapshot("first").recentOperations.length > cancelCount && !ctx.snapshot("first").operation, "browser cancellation terminal outcome");

assert(["cancelled", "unknown"].includes(ctx.snapshot("first").recentOperations.at(-1).status));

await ctx.page.locator('#messages .pi-operation-outcome[data-status="cancelled"], #messages .pi-operation-outcome[data-status="canceled"], #messages .pi-operation-outcome[data-status="unknown"]').waitFor({ state: "visible" });

assert.equal(await ctx.page.locator("#messages .pi-operation-outcome").count(), 1, "A cancelled operation reports its result once, where the turn ended");

await ctx.runHere("first", "assert session_value == 41\nprint('safe-reuse', session_value)", "safe-reuse 41");

const unknownCode = "print('unknown-send-must-not-run')";

const usersBeforeUnknown = ctx.snapshot("first").messages.filter(({ role }) => role === "user").length;

await ctx.page.route(`**/api/sessions/${ctx.names.get("first")}/send`, (route) => route.abort("failed"), { times: 1 });

await ctx.send(unknownCode);

await ctx.page.locator('.pi-send-status[data-state="unknown"]').waitFor({ state: "visible" });

assert.equal(ctx.snapshot("first").messages.filter(({ role }) => role === "user").length, usersBeforeUnknown, "An aborted request adds no SDK user message");

await ctx.page.reload();

await ctx.connected(ctx.names.get("first"));

assert.equal(ctx.snapshot("first").messages.filter(({ role }) => role === "user").length, usersBeforeUnknown, "Reconnect does not replay an unknown send");

await ctx.page.route(`**/api/sessions/${ctx.names.get("first")}/send`, (route) => route.fulfill({ status: 503, contentType: "application/json",
    body: JSON.stringify({ error: "No kernel could be started; this input was not submitted.", code: "UNAVAILABLE", details: { submitted: false, stage: "kernel", reason: "fixture target unreachable" } }) }), { times: 1 });

const boxesOf = () => ctx.page.evaluate(() => {
    const box = (selector) => { const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect(); return { x, y, width, height }; };
    return { transcript: box("#transcript"), composer: box("#composer"), chat: box(".pi-chatcol") };
  });

await ctx.page.locator("#composer").fill("print('refused-send')");

const boxesBefore = await boxesOf();

await ctx.page.locator("#send-message").click();

await ctx.page.locator('#connection-banner[data-kind="send-rejected"][data-stage="kernel"][data-submitted="false"]').waitFor({ state: "visible" });

assert.deepEqual((await boxesOf()), boxesBefore, "a banner appearing does not move or resize the transcript, composer or chat column");

const bannerGeometry = await ctx.page.evaluate(() => {
    const banner = document.querySelector("#connection-banner").getBoundingClientRect();
    const column = document.querySelector(".pi-chatcol").getBoundingClientRect();
    const composer = document.querySelector("#composer").getBoundingClientRect();
    const hit = document.elementFromPoint(banner.x + banner.width / 2, banner.y + banner.height / 2);
    return { inside: banner.left >= column.left && banner.right <= column.right && banner.top >= column.top && banner.bottom <= column.bottom, aboveComposer: banner.bottom <= composer.top, hitsBanner: Boolean(hit?.closest("#connection-banner")), floating: Boolean(document.querySelector("#connection-banner")?.closest(".pi-chatcol > .pi-banner-lane > #session-banners")) };
  });

assert.deepEqual(bannerGeometry, { inside: true, aboveComposer: true, hitsBanner: true, floating: true }, "the banner floats inside the chat column, clear of the composer, and is clickable");

assert((await ctx.page.locator("#connection-banner").textContent()).includes("fixture target unreachable"), "backend refusal reason remains visible");

assert.equal(await ctx.page.locator('.pi-send-status[data-state="unknown"]').count(), 0, "A refused send is not reported as unknown");

assert.equal(await ctx.page.locator("#composer").inputValue(), "print('refused-send')", "A refused send keeps the draft");

await ctx.page.locator("#composer").fill("");

// A chat-context error on the open session (re-selecting it no longer refetches, so a failed rename provides one).
await ctx.page.route(`**/api/sessions/${ctx.names.get("first")}/rename`, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "fixture chat error" }) }), { times: 1 });

await ctx.sessionAction("rename-session");

await ctx.page.locator('#management-dialog[data-kind="rename"] button[type="submit"]').click();

await ctx.page.keyboard.press("Escape");

const chatError = ctx.page.locator("#chat-error");

await chatError.waitFor({ state: "visible" });

assert.equal(await chatError.getAttribute("role"), "alert", "A chat-context error is announced as an alert");

assert.match(await chatError.textContent(), /fixture chat error/, "The actual failure text appears in the banner");

assert.equal(await ctx.page.locator("#notice").count(), 0, "The same error is not duplicated in the shell while a session is open");

assert.equal(await ctx.page.locator("#chat-error").count(), 1, "one error element for the one error");

assert.equal(await ctx.page.locator("#connection-banner #chat-error").count(), 1, "it lives in the banner, not above the composer");

assert.equal(await ctx.page.locator(".pi-composer-wrap #chat-error").count(), 0);

await ctx.page.locator("#connection-banner .mantine-Alert-closeButton").click();

await chatError.waitFor({ state: "hidden" });

await ctx.selectSession("first");

assert.equal(await ctx.page.locator("#chat-error").count(), 0, "A dismissed chat error does not return on a normal reconnect");

await ctx.page.locator('#management-connection-status[data-status="connected"]').waitFor();

await ctx.createSession("alpha", "second", { cwd: "session-two" });

assert(!(await ctx.page.locator("#messages").textContent()).includes("safe-reuse"), "Switching sessions must not leak the previous conversation");

await ctx.runHere("second", `from pathlib import Path\nassert str(Path.cwd()) == ${JSON.stringify(join(ctx.workbenchTempRoot, "session-two"))}\nassert 'session_value' not in globals()\nsession_value = 99\nprint('value=', session_value, flush=True)`, "value= 99");

const secondSession = ctx.snapshot("second").sessionId;

}
