import { openSidebar } from "./open-sidebar.mjs";

export async function openRowMenu(page, phone, name) {
  if (phone) await openSidebar(page);
  await page.locator(`[data-worker="${name}"] [data-action="session-menu"]`).click();
  await page.locator(".management-worker-dropdown").waitFor();
}
