// Opens the settings window page or the fixture instance's settings tab the way a user does (drawer on phones).
export function settingsNavigation(page) {
  const openSidebar = async () => {
    if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
  };
  return {
    openSettings: async (section) => {
      await openSidebar();
      await page.locator("#open-settings").click();
      await page.locator(`[data-settings-section="${section}"]`).click();
    },
    openInstance: async (tab) => {
      await openSidebar();
      await page.locator('[data-action="instance-menu"][data-target="fixture"]').click();
      await page.locator('[data-action="instance-settings"][data-target="fixture"]').click();
      await page.locator(`#instance-settings [data-instance-tab="${tab}"]`).click();
    },
  };
}
