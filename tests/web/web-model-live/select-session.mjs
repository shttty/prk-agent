

export async function selectSession(ctx, page, sessionId) {
  const button = page.locator(`[data-session-id="${sessionId}"]`);
  await button.waitFor({ state: "attached", timeout: 30_000 });
  await button.waitFor({ state: "visible", timeout: 30_000 });
  if (await button.getAttribute("aria-current") !== "true") await button.click();
  await page.waitForFunction((name) => document.querySelector(`[data-session-id="${CSS.escape(name)}"]`)?.getAttribute("aria-current") === "true", sessionId, { timeout: 30_000 });
}
