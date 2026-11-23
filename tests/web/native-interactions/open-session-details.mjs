import assert from "node:assert/strict";

export async function openSessionDetails(ctx, page, expectedSessionId, touch = false) {
    await ctx.openSessionMenu(page, touch);
    const detailsMenu = page.locator("#session-details");
    if (touch) await detailsMenu.tap(); else await detailsMenu.click();
    const dialog = page.getByRole("dialog").filter({ has: page.locator("#session-id") });
    await dialog.waitFor({ state: "visible" });
    const sessionId = dialog.locator("#session-id");
    await sessionId.waitFor({ state: "visible" });
    await page.waitForFunction((value) => document.querySelector('[role="dialog"] #session-id')?.textContent?.trim() === value, expectedSessionId);
    const observedSessionId = (await sessionId.innerText()).trim();
    assert.ok(observedSessionId, "native session identity is visible");
    assert.equal(observedSessionId, expectedSessionId, "exact SDK session identity");
    const close = dialog.locator("#close-session-details");
    if (touch) await close.tap(); else await close.click();
    await dialog.waitFor({ state: "hidden" });
    return observedSessionId;
  }
