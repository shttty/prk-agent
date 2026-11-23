import assert from "node:assert/strict";
import { join } from "node:path";
import { startWebDev } from "../web-dev.mjs";
import { loadChromium } from "../workspace-mock/load-chromium.mjs";

export async function checkIsolationBrowser({ apiUrl, good, bad, scenario, evidence }) {
  let ui, browser;
  const errors = [], forbidden = [];
  try {
    ui = await startWebDev(apiUrl);
    browser = await loadChromium();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      const sessionRead = /^\/api\/sessions\/[^/]+\/(?:history|wake)$/.test(path);
      if (path === `/api/sessions/${bad.sessionId}/history` || path === `/api/sessions/${bad.sessionId}/wake`
        || (bad.sessionId === undefined && sessionRead && !path.startsWith(`/api/sessions/${good.sessionId}/`))) forbidden.push(`${request.method()} ${path}`);
    });
    await page.goto(ui.url);
    const healthy = page.locator(`[data-session-id="${good.sessionId}"]`);
    await healthy.locator(".management-session-select").click();
    await page.waitForFunction(() => document.querySelector(".pi-messages")?.textContent?.includes("ISOLATION_HEALTHY_HISTORY"));
    assert.equal(await healthy.getAttribute("aria-current"), "true");
    if (scenario.archived) {
      await page.locator("#open-settings").click();
      await page.locator("#open-archive").click();
    }
    const scope = scenario.archived ? page.locator(`#settings-archive [data-archive-group="${bad.sessionId}"]`)
      : page.locator(`[data-group="${scenario.location === "unknown" ? "unreadable-unknown" : "fixture"}"]`);
    const identity = bad.sessionId === undefined ? `[data-session-file=${JSON.stringify(bad.sessionFile)}]` : `[data-session-id=${JSON.stringify(bad.sessionId)}]`;
    const row = scope.locator(`[data-status="unreadable"]${identity}`);
    await row.waitFor({ state: "visible" });
    assert.equal(await row.locator("[data-unreadable-warning]").count(), 1, "Unreadable is a warning marker, not an operation-error dot");
    assert.equal(await page.locator("#unreadable-sessions-banner").count(), 0, "Unreadable sessions stay at their list positions, not a top banner");
    await row.hover();
    await row.click();
    const reason = page.locator(`#unreadable-session-reason${identity}`);
    await reason.waitFor({ state: "visible" });
    assert((await reason.textContent()).includes(scenario.field), "The reason view exposes the persisted field path");
    assert.equal(await reason.locator("#composer, .pi-message").count(), 0, "An unreadable selection shows only its reason, not chat");
    assert.equal(await healthy.getAttribute("aria-current"), "true", "The healthy chat selection is unchanged");
    await page.screenshot({ path: join(evidence, `${scenario.name}.png`), animations: "disabled" });
    await page.locator("#close-unreadable-session-reason").click();
    await reason.waitFor({ state: "hidden" });
    if (scenario.archived && await page.locator("#close-settings").isVisible()) await page.locator("#close-settings").click();
    await healthy.locator(".management-session-select").click();
    await page.waitForFunction(() => document.querySelector(".pi-messages")?.textContent?.includes("ISOLATION_HEALTHY_HISTORY"));
    assert.equal(await page.locator("#composer").isVisible(), true, "Healthy navigation remains usable");
    assert.deepEqual(forbidden, [], "Unreadable row selection never issues history or wake requests");
    assert.deepEqual(errors, [], "No browser runtime errors");
  } finally {
    await browser?.close();
    await ui?.close();
  }
}
