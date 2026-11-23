/** Open 会话详情 of session `name` from its sidebar row menu (phone: through the drawer), where the session's own
 * settings live (send mode, delegation, local/native tools, auto compaction/retry). `touch` taps instead of clicking. */
export async function openSessionDetails(page, name, { touch = false } = {}) {
  const press = (locator) => (touch ? locator.tap() : locator.click());
  const drawer = page.locator("#open-sidebar");
  if (await drawer.isVisible() && await drawer.getAttribute("aria-expanded") !== "true") await press(drawer);
  await press(page.locator(`[data-session-id=${JSON.stringify(name)}] [data-action="session-menu"]`));
  await press(page.locator("#session-details"));
  await page.locator("#close-session-details").waitFor();
}

export async function closeSessionDetails(page, { touch = false } = {}) {
  const close = page.locator("#close-session-details");
  await (touch ? close.tap() : close.click());
  await close.waitFor({ state: "detached" });
}
