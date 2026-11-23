import { openRowMenu } from "./open-row-menu.mjs";

export async function runMenuAction(page, phone, name, id) {
  await openRowMenu(page, phone, name);
  await page.locator(`#${id}`).click();
}
