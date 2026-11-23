import assert from "node:assert/strict";
import { toggle } from "./find-toggle.mjs";

export async function closeCard(page) {
  await toggle(page).click();
  await page.locator("#monitor-card").waitFor({ state: "detached" });
  assert.equal(await toggle(page).getAttribute("aria-pressed"), "false");
}
