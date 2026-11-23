/** Select a session in the sidebar list and wait for its composer. */
export async function selectSession(page, name) {
  await page.locator(`[data-session-id="${name}"] .management-session-select`).click();
  await page.locator("#composer").waitFor();
}

