export async function openProcessFold(page) {
  await page.locator("details.pi-turn-process").first().waitFor();
  await page.waitForTimeout(250);
  await page.locator("details.pi-turn-process > summary").first().click();
  await page.waitForTimeout(200);
}
