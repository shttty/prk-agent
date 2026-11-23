import { dialogClosed } from "./dialog-closed.mjs";
export async function closeCreate(page) {
  await page.locator("#close-management-dialog").click();
  await dialogClosed(page);
}
