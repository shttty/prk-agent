import assert from "node:assert/strict";

export async function recoverWithNewKernel(ctx, page, sessionId) {
    const pending = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname === `/api/sessions/${encodeURIComponent(sessionId)}/recover`);
    // One recovery action: a closed session always gets a new runtime (nothing is adopted).
    if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
    await page.locator('[data-session-id][aria-current="true"]').locator('[data-action="session-menu"]').click();
    await page.locator("#recover-kernel").click();
    const response = await pending;
    assert.equal(response.status(), 200);
    assert.deepEqual(response.request().postDataJSON(), { mode: "auto" });
    assert.equal((await response.json()).session.recovery.status, "new");
    await page.waitForFunction(() => document.querySelector("#composer")?.disabled === false);
  }
