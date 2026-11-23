import { showSidebar } from "./show-sidebar.mjs";
export async function openProjectView(page) {
  await showSidebar(page);
  await page.locator('#management-view-switch input[value="projects"] + label').click();
}
