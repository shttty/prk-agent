import { openSidebar } from "./open-sidebar.mjs";

export async function selectSession(page, phone, name) {
  if (phone) await openSidebar(page);
  await page.locator(`[data-worker="${name}"] .management-worker-select`).click();
  await page.locator("#composer").waitFor();
  await page.waitForTimeout(phone ? 450 : 250);
}
