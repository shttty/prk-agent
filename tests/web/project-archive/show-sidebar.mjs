// Drawer state changes before its exit transition completes; visibility alone is not its opened state.
export async function showSidebar(page) {
  const toggle = page.locator("#open-sidebar");
  if (!(await toggle.isVisible())) return;
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  await page.locator('#open-sidebar[aria-expanded="true"]').waitFor();
  await page.locator(".mantine-Drawer-content", { has: page.locator("#management-view-switch") }).waitFor();
}
