import { showSidebar } from "./show-sidebar.mjs";
import { dialogOpen } from "./dialog-open.mjs";
export async function openCreate(page, trigger) {
  await showSidebar(page);
  await page.locator(trigger).click();
  await dialogOpen(page, "create");
  await page.locator("#management-dialog [data-project-selector]").waitFor();
}
