// ------------------------------------------------- web-only restart
  // Only the browser adapter is restarted. The Gateway keeps every SDK session
  // and every kernel; the routing identities keep addressing the same sessions.
// Restart only the API adapter process; the UI dev server keeps running and
  // the new adapter listens where its /api proxy points.
// ------------------------------------------- ownership and cleanup boundaries
// The Web gets a concise, useful error while the Gateway log keeps diagnostics.
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { verifySessionPresentationPersistence } from ".././web-mobile-checks.mjs";

export async function checkSelectionAndWebRestart(ctx) {
Object.defineProperties(ctx, {
    before: { configurable: true, get: () => before },
    kernelsBeforeRestart: { configurable: true, get: () => kernelsBeforeRestart },
    webOrigins: { configurable: true, get: () => webOrigins },
    kernelsAfterRestart: { configurable: true, get: () => kernelsAfterRestart },
    after: { configurable: true, get: () => after },
    providerFailure: { configurable: true, get: () => providerFailure },
});

const secondKernel = ctx.snapshot("second").kernel.kernelId;

assert(secondKernel);

assert.notEqual(secondKernel, ctx.firstKernel, "Each session on one environment gets its own kernel");

assert.equal((await ctx.ids()).length, ctx.sentinelIds.length + 2, "Exactly two Gateway-owned kernels are live");

await verifySessionPresentationPersistence({ page: ctx.page, phone: ctx.phone, names: ctx.names, selectSession: ctx.selectSession, selectSessionOn: ctx.selectSessionOn, connected: ctx.connected, connectedOn: ctx.connectedOn });

await ctx.selectSession("first");

await ctx.selectSessionOn(ctx.phone, "second");

assert.equal(await ctx.page.locator(".management-session-row.is-selected").getAttribute("data-session-id"), ctx.names.get("first"));

assert.equal(await ctx.phone.locator("#topbar-title").textContent(), ctx.host.workbench().sessions.find((worker) => worker.sessionId === ctx.names.get("second")).label, "Independent browser contexts retain independent selections");

await ctx.selectSession("first");

await ctx.page.waitForTimeout(100);

await ctx.page.locator("#transcript").hover();

const transcriptTopBeforeWheel = await ctx.page.locator("#transcript").evaluate((node) => node.scrollTop);

await ctx.page.mouse.wheel(0, -200);

await ctx.page.waitForFunction((previousTop) => {
    const node = document.querySelector("#transcript");
    return Boolean(node) && node.scrollTop < previousTop;
  }, transcriptTopBeforeWheel);

const readerAnchor = await ctx.page.locator("#transcript").evaluate((viewport) => {
    const viewportTop = viewport.getBoundingClientRect().top;
    const candidate = [...viewport.querySelectorAll(".pi-message")].find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.bottom > viewportTop + 2 && rect.top < viewportTop + viewport.clientHeight;
    });
    return candidate ? { id: candidate.getAttribute("data-message-id"), offset: candidate.getBoundingClientRect().top - viewportTop } : null;
  });

assert(readerAnchor?.id, "Reader has a visible message anchor before switching sessions");

await ctx.selectSession("second");

await ctx.selectSession("first");

await ctx.wait(async () => ctx.page.locator("#transcript").evaluate((viewport, anchor) => {
    const node = viewport.querySelector(`[data-message-id="${CSS.escape(anchor.id)}"]`);
    return Boolean(node) && Math.abs(node.getBoundingClientRect().top - viewport.getBoundingClientRect().top - anchor.offset) < 4;
  }, readerAnchor), "Transcript restores the same visible message anchor");

// After a reload the viewport remounts believing it is at the bottom; the restore then scrolls DOWN to the anchor,
// which assistant-ui never counts as leaving the bottom, so its ScrollToBottom stayed disabled.
await ctx.page.reload();

await ctx.connected(ctx.names.get("first"));

await ctx.wait(async () => ctx.page.locator("#transcript").evaluate((viewport, anchor) => {
    const node = viewport.querySelector(`[data-message-id="${CSS.escape(anchor.id)}"]`);
    return Boolean(node) && Math.abs(node.getBoundingClientRect().top - viewport.getBoundingClientRect().top - anchor.offset) < 4;
  }, readerAnchor), "Transcript restores the reader anchor after reload");

await ctx.page.locator("#new-messages").waitFor({ state: "visible" });

assert.equal(await ctx.page.locator("#new-messages").isEnabled(), true, "Jump-to-bottom is clickable after a restored mid-transcript position");

await ctx.page.locator("#new-messages").click();

await ctx.page.waitForFunction(() => { const node = document.querySelector("#transcript"); return node && node.scrollHeight - node.clientHeight - node.scrollTop < 4; });

// Let the jump's scroll event land first: scrolling up in the same frame looks to assistant-ui like content growth, not a reader.
await ctx.page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

// A reader scroll (wheel), not a scrollTop write: only reader input stops following.
await ctx.page.locator("#transcript").hover();
await ctx.page.mouse.wheel(0, -100000);
await ctx.page.waitForFunction(() => document.querySelector("#transcript").scrollTop === 0);
const transcriptHeight = await ctx.page.locator("#transcript").evaluate((node) => node.scrollHeight - node.clientHeight);

assert(transcriptHeight > 20);

const readerTopBeforeJump = await ctx.page.locator("#transcript").evaluate((node) => node.scrollTop);

await ctx.selectSessionOn(ctx.phone, "first");

const newMessageCount = ctx.snapshot("first").recentOperations.length;

await ctx.sendOn(ctx.phone, "print('mobile-new-message', flush=True)");

await ctx.wait(() => ctx.snapshot("first").recentOperations.length > newMessageCount && !ctx.snapshot("first").operation, "cross-browser new message");

await ctx.page.locator("#new-messages").waitFor({ state: "visible" });

assert(Math.abs(await ctx.page.locator("#transcript").evaluate((node) => node.scrollTop) - readerTopBeforeJump) < 4, "New messages do not move the reader before jump");

await ctx.page.locator("#new-messages").click();

await ctx.page.waitForFunction(() => { const node = document.querySelector("#transcript"); return node && node.scrollHeight - node.clientHeight - node.scrollTop < 4; });

await ctx.page.locator("#new-messages").waitFor({ state: "hidden" });

const before = {
    first: { sessionId: ctx.firstSession, kernelId: ctx.firstKernel },
    second: { sessionId: ctx.secondSession, kernelId: secondKernel },
  };

const kernelsBeforeRestart = await ctx.ids();

const previousUrl = ctx.url();

const previousPid = ctx.webProcess.child.pid;

await ctx.stopWebProcess(ctx.webProcess);

ctx.webProcess = undefined;

ctx.webProcess = await ctx.startWebProcess(ctx.socket, ctx.apiPort);

assert.notEqual(ctx.webProcess.child.pid, previousPid, "The restarted adapter is a genuinely new process");

assert.equal(ctx.url(), previousUrl, "The restarted adapter listens where the UI proxy points");

const webOrigins = { ui: ctx.ui.url, api: ctx.url(), apiPids: [previousPid, ctx.webProcess.child.pid] };

const kernelsAfterRestart = await ctx.ids();

assert.deepEqual(kernelsAfterRestart, kernelsBeforeRestart, "Restarting only the web adapter creates no kernel and releases none");

assert.deepEqual(ctx.host.workbench().sessions.map(({ sessionId }) => sessionId).sort(), [before.first.sessionId, before.second.sessionId].sort(), "The Gateway still owns both sessions after the web restart");

const restarted = JSON.parse(await (await ctx.request("/api/workbench")).text());

assert(restarted.sessions.every((session) => !Object.hasOwn(session, "name")), "The adapter exposes no second session route identity");

assert.deepEqual(restarted.sessions.map(({ sessionId }) => sessionId).sort(), [before.first.sessionId, before.second.sessionId].sort(), "The restarted adapter serves the same SDK sessions");

await ctx.page.goto(ctx.ui.url);

await ctx.phone.goto(ctx.ui.url);

const after = {};

for (const key of ["first", "second"]) {
    await ctx.selectSession(key);
    const served = await ctx.httpSnapshot(key);
    after[key] = { sessionId: served.sessionId, kernelId: served.kernel.kernelId };
    assert.equal(served.sessionId, ctx.snapshot(key).sessionId, "The restarted adapter serves the Gateway's own snapshot");
  }

assert.deepEqual(after, before, "SDK sessionId and kernel id all survive a web-only restart");

await ctx.selectSession("first");

await ctx.runHere("first", "assert session_value == 41, session_value\nprint('after-restart=', session_value, flush=True)", "after-restart= 41");

await ctx.selectSession("second");

await ctx.runHere("second", "assert session_value == 99, session_value\nprint('after-restart=', session_value, flush=True)", "after-restart= 99");

assert.equal(ctx.snapshot("first").kernel.kernelId, before.first.kernelId, "Executing after the restart reuses the same kernel");

assert.equal(ctx.snapshot("second").kernel.kernelId, before.second.kernelId);

assert.deepEqual(await ctx.ids(), kernelsBeforeRestart, "Executing after the restart started no additional kernel");

await ctx.noOverflow(ctx.page);

await ctx.page.screenshot({ path: join(ctx.evidence, "desktop-after-web-restart.png"), fullPage: true, animations: "disabled" });

await ctx.selectSession("first");

await ctx.sessionAction("archive-session");

await ctx.page.locator('#management-dialog[data-kind="archive"] [data-action="cancel"]').click();

assert.notEqual(ctx.snapshot("first").state, "closed", "Archive needs confirmation");

await ctx.sessionAction("archive-session");

await ctx.page.locator('#management-dialog[data-kind="archive"] #confirm-archive').click();

await ctx.wait(() => !ctx.host.workbench().sessions.some(({ sessionId }) => sessionId === ctx.names.get("first")), "browser archive hides session");

await ctx.page.locator(`.management-session-row[data-session-id="${ctx.names.get("first")}"]`).waitFor({ state: "hidden" });

await ctx.wait(async () => (await ctx.sessionKernels("session-one")).length === 0, "archive releases its own REPL process");

await ctx.page.locator("#open-settings").click();

await ctx.page.locator("#open-archive").click();

const archive = ctx.page.locator("#settings-archive");

await archive.locator(`[data-archive-group="${ctx.names.get("first")}"] [data-action="unarchive"]`).click();

await archive.locator('[data-state="empty"]').waitFor();

assert(ctx.host.history(ctx.names.get("first")).snapshot.messages.length > 0, "Unarchive retains SDK history");

await ctx.page.keyboard.press("Escape");

await ctx.selectSession("first");

await ctx.runHere("first", "session_value = 41\nprint('archive-resumed=', session_value, flush=True)", "archive-resumed= 41");

assert.notEqual(ctx.snapshot("first").kernel.kernelId, before.first.kernelId, "Unarchived session starts a new runtime on message");

assert.equal((await ctx.sessionKernels("session-two")).length, 1, "A sibling session on the same environment keeps its REPL process");

assert.equal(ctx.snapshot("second").state, "idle");

assert.match(ctx.text(await ctx.sentinel.tool.execute("sentinel-still-live", { code: "print(sentinel_value)" }, ctx.signal)), /73/, "The unrelated sentinel kernel is untouched");

await ctx.noOverflow(ctx.page);

await ctx.page.screenshot({ path: join(ctx.evidence, "desktop-closed.png"), fullPage: true, animations: "disabled" });

await ctx.phone.locator("#open-sidebar").click();

await ctx.phone.locator(`.management-session-row[data-session-id="${ctx.names.get("second")}"]`).click();

await ctx.noOverflow(ctx.phone);

await ctx.phone.screenshot({ path: join(ctx.evidence, "phone-closed.png"), fullPage: true, animations: "disabled" });

await ctx.selectSession("second");

await ctx.runHere("second", "assert session_value == 99, session_value\nprint('sibling-survives-close=', session_value, flush=True)", "sibling-survives-close= 99");

assert.equal(ctx.snapshot("second").kernel.kernelId, before.second.kernelId);

const providerFailureResponse = () => {
    const message = fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error" });
    message.diagnostics = [{
      type: "provider_transport_failure",
      timestamp: Date.now(),
      error: { name: "Error", message: "WebSocket error", stack: "Error: WebSocket error\n    at fixtureTransport" },
      details: { configuredTransport: "websocket", phase: "receive", requestBytes: 321, marker: ctx.PROVIDER_DIAGNOSTIC_MARKER },
    }];
    return message;
  };

ctx.faux.setResponses(Array.from({ length: 8 }, providerFailureResponse));

await ctx.selectSession("second");

const providerFailureCount = ctx.snapshot("second").recentOperations.length;

await ctx.send("provider-failure-probe");

await ctx.wait(() => ctx.snapshot("second").recentOperations.length > providerFailureCount && !ctx.snapshot("second").operation, "provider failure terminal");

const providerFailure = ctx.snapshot("second").recentOperations.at(-1);

}
