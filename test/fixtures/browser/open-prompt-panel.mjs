/** Opens the workspace, switches debug mode on and opens the prompt debug tool of the session shown; returns the panel locator once it has read the request. */
export async function openPromptPanel(page) {
  const toggle = page.locator("#toggle-workspace");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await page.locator("#new-terminal").waitFor();
  await page.locator("#open-settings").click();
  await page.locator('label.pi-settings-title[for="setting-debug-mode"]').click();
  await page.locator("#close-settings").click();
  await page.locator('[data-action="debug-tools"]').click();
  await page.locator('[data-action="open-debug-tool"][data-tool="prompt"]').click();
  const panel = page.locator('[data-panel="prompt"]');
  await page.locator('[data-panel="prompt"][data-status="ok"]').waitFor();
  return panel;
}
