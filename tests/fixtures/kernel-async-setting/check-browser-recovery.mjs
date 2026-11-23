import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { until } from "./create-fixture.mjs";

export async function expandKernelRow(row) {
  for (const detail of await row.locator("xpath=ancestor-or-self::details").all()) {
    if (!await detail.evaluate((node) => node.open)) await detail.locator(":scope > summary").click();
  }
}

export async function assertUniqueKernelRows(page) {
  const identities = await page.locator('[data-kind="kernel-cell"]').evaluateAll((nodes) => nodes.map((node) =>
    ["sessionId", "kernelId", "cellId", "toolCallId"].map((field) => node.dataset[field])));
  assert(identities.every((identity) => identity.every(Boolean)), "every cell row carries its full identity");
  const keys = identities.map((identity) => JSON.stringify(identity));
  assert.equal(new Set(keys).size, keys.length, "one row per (sessionId,kernelId,cellId,toolCallId)");
}

export async function checkBrowserRecovery(f, cell, rowFor) {
  const { page, sessionId } = f;
  const path = `/api/sessions/${encodeURIComponent(sessionId)}/events`;
  let streamResponses = 0, navigations = 0, cancelRequests = 0;
  const response = (reply) => { if (new URL(reply.url()).pathname === path && reply.status() === 200) streamResponses++; };
  const loaded = () => { navigations++; };
  const request = (entry) => { if (entry.method() === "POST" && /\/(?:kernel\/interrupt|cancel)$/.test(new URL(entry.url()).pathname)) cancelRequests++; };
  page.on("response", response);
  page.on("load", loaded);
  page.on("request", request);
  try {
    const original = await f.state();
    await page.reload();
    await page.locator(`[data-session-id=${JSON.stringify(sessionId)}] .management-session-select`).click();
    await rowFor(cell).waitFor({ state: "attached" });
    assert.equal(await rowFor(cell).getAttribute("data-status"), "running");
    assert.equal(navigations, 1, "one intentional document reload");
    await assertUniqueKernelRows(page);
    const beforeReconnect = streamResponses;
    await f.restartWeb(); // Real observation disconnect: Gateway/Python remain alive, Vite target stays on the same port.
    await until(() => streamResponses > beforeReconnect, "real browser session SSE reconnect", 30_000);
    await rowFor(cell).waitFor({ state: "attached" });
    assert.equal(navigations, 1, "SSE recovery does not reload the document");
    const reconnected = await f.state();
    assert.equal(reconnected.streamId, original.streamId, "Web restart does not replace the Gateway host");
    assert.deepEqual(reconnected.kernel.activeCells.map(({ cellId }) => cellId), [cell.cellId]);
    assert.equal(reconnected.kernel.kernelId, cell.kernelId);
    await assertUniqueKernelRows(page);

    const input = page.locator("#composer");
    await input.fill("IME_DRAFT");
    let composing;
    await page.exposeFunction("recordKernelImeEscape", (value) => { composing = value; });
    // Read-only key observation; use Chromium's real IME instead of synthetic composition events.
    await input.evaluate((element) => element.addEventListener("keydown", (event) => { void window.recordKernelImeEscape(event.isComposing); }, { once: true }));
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send("Input.imeSetComposition", { text: "中文", selectionStart: 2, selectionEnd: 2 });
      await input.press("Escape");
      await until(() => composing !== undefined, "genuine IME Escape observation");
      assert.equal(composing, true);
      await cdp.send("Input.insertText", { text: "中文" });
    } finally { await cdp.detach(); }
    await delay(100);
    assert.equal(cancelRequests, 0, "IME Escape does not request cancellation");
    assert.deepEqual((await f.state()).kernel.activeCells.map(({ cellId }) => cellId), [cell.cellId]);
    await input.fill("/");
    await page.locator("#native-candidate-list").waitFor({ state: "visible" });
    await input.press("Escape");
    await page.locator("#native-candidate-list").waitFor({ state: "hidden" });
    assert.equal(cancelRequests, 0, "completion Escape only dismisses completion");
    await input.fill("");
    await page.locator("#open-settings").click();
    await page.locator('#setting-kernel-async-execution[data-status="ready"]').waitFor();
    await page.locator("#setting-kernel-async-execution").focus();
    await page.keyboard.press("Escape");
    await page.locator("#close-settings").waitFor({ state: "hidden" });
    await page.locator('#settings-dialog[role="dialog"]').waitFor({ state: "detached" });
    assert.equal(cancelRequests, 0, "modal Escape does not reach the composer cancellation path");
    assert.deepEqual((await f.state()).kernel.activeCells.map(({ cellId }) => cellId), [cell.cellId]);
    await f.idle();
    assert.equal(await page.locator("#cancel-operation").isVisible(), true, "idle SDK still exposes the background-cell stop control");
    await until(() => page.locator("#cancel-operation").isEnabled(), "background stop enabled after reconnect");
    const calls = f.requests.length;
    await input.focus();
    const [interrupt] = await Promise.all([
      page.waitForRequest((entry) => entry.method() === "POST" && new URL(entry.url()).pathname === `/api/sessions/${encodeURIComponent(sessionId)}/kernel/interrupt`, { timeout: 5_000 }),
      input.press("Escape"),
    ]);
    assert.deepEqual(interrupt.postDataJSON(), { kernelId: cell.kernelId, cellId: cell.cellId });
    await until(async () => (await f.events(cell.cellId, "finished")).find((event) => event.details.outcome === "aborted"), "targeted background Esc outcome");
    await f.idle();
    await until(async () => await rowFor(cell).getAttribute("data-status") === "aborted", "aborted row");
    assert.equal(cancelRequests, 1, "ordinary composer Escape sends exactly one directed cancel");
    assert.equal(f.requests.length, calls, "explicit stop records the result without waking the model");
    assert.equal((await f.events(cell.cellId, "finished")).length, 1);
    await assertUniqueKernelRows(page);
    return { reloads: navigations, reconnects: streamResponses - beforeReconnect, imeEscape: composing, completionEscape: "dismissed", modalEscape: "dismissed", directedCancels: cancelRequests, outcome: "aborted" };
  } finally {
    page.off("response", response);
    page.off("load", loaded);
    page.off("request", request);
  }
}
