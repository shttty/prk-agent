import assert from "node:assert/strict";

export async function selectSession(ctx, page, sessionId, touch = false, allowHistoryOnly = false) {
    const menu = page.locator("#open-sidebar");
    if (await menu.count() && await menu.isVisible()) {
      if (await menu.getAttribute("aria-expanded") !== "true") { if (touch) await menu.tap(); else await menu.click(); }
    }
    const row = page.locator(`[data-session-id=${JSON.stringify(sessionId)}]`).first();
    await row.waitFor({ state: "attached" });
    const group = row.locator("xpath=ancestor::section[contains(@class,'management-group')][1]");
    const groupToggle = group.locator(".management-group-header").first();
    if (await groupToggle.count() && await groupToggle.getAttribute("aria-expanded") === "false") { if (touch) await groupToggle.tap(); else await groupToggle.click(); }
    await row.waitFor({ state: "visible" });
    if (touch) await row.tap(); else await row.click();
    await page.waitForFunction((name) => document.querySelector(`[data-session-id=${JSON.stringify(name)}]`)?.getAttribute("aria-current") === "true", sessionId);
    const observedSessionId = await ctx.openSessionDetails(page, sessionId, touch);
    if (allowHistoryOnly) {
      // A closed worker is not read-only and shows no banner; the composer says a message brings the kernel back.
      await page.waitForFunction(() => document.querySelector("#composer")?.getAttribute("data-status") === "closed");
      assert.equal(await page.locator("#composer").isDisabled(), false, "a closed worker stays sendable");
      assert.equal(await page.locator("#recovery-controls").count(), 0, "a plain closed worker shows no recovery banner");
    }
    return observedSessionId;
  }
