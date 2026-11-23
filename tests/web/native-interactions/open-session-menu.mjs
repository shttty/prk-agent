

export async function openSessionMenu(ctx, page, touch = false) {
    const sidebar = page.locator("#open-sidebar");
    if (await sidebar.isVisible() && await sidebar.getAttribute("aria-expanded") !== "true") {
      if (touch) await sidebar.tap(); else await sidebar.click();
    }
    const settings = page.locator('[data-session-id][aria-current="true"]').locator('[data-action="session-menu"]');
    if (touch) await settings.tap(); else await settings.click();
  }
