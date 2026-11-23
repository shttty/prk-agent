import { assertUniqueIds } from "../../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { toggle } from "./find-toggle.mjs";

/** Show the panel: desktop has it shown by default (the toggle is pressed), the phone opens its sheet on demand. */
export async function openCard(page) {
  if ((await toggle(page).getAttribute("aria-pressed")) !== "true") await toggle(page).click();
  await page.locator("#monitor-card").waitFor();
  await assertUniqueIds(page, "card open");
}
