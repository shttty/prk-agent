/** "恢复执行环境" lives in the session menu (closed sessions show no banner). */
export async function recoverFromMenu(page) {
  if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
  await page.locator('[data-session-id][aria-current="true"]').locator('[data-action="session-menu"]').click();
  await page.locator("#recover-kernel").click();
  const drawer = page.getByRole("dialog");
  if (await drawer.isVisible()) { await page.keyboard.press("Escape"); await drawer.waitFor({ state: "hidden" }); }
}