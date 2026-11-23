import assert from "node:assert/strict";
import { join } from "node:path";
import { openCreate } from "./open-create.mjs";
import { closeCreate } from "./close-create.mjs";
import { dialogOpen } from "./dialog-open.mjs";
import { openProjectView } from "./open-project-view.mjs";
import { showSidebar } from "./show-sidebar.mjs";

export async function checkCreatePreselect(page, { device, evidence, project }) {
  const selector = page.locator("#management-dialog [data-project-selector]");
  const assertPreselected = async (trigger, expected) => {
    await openCreate(page, trigger);
    assert.equal(await selector.getAttribute("data-selected"), expected);
  };
  await assertPreselected(`[data-action="create-session"][data-project="${project.id}"]`, project.id);
  await page.screenshot({ path: join(evidence, `${device}-create-preselected.png`), animations: "disabled" });
  await closeCreate(page);
  await showSidebar(page);
  await page.locator(`[data-action="project-menu"][data-project="${project.id}"]`).click();
  await page.locator(`[data-action="project-create-session"][data-project="${project.id}"]`).click();
  await dialogOpen(page, "create");
  await selector.waitFor();
  assert.equal(await selector.getAttribute("data-selected"), project.id);
  await closeCreate(page);
  await assertPreselected('[data-action="create-session"][data-project="project:ungrouped"]', "");
  await closeCreate(page);
  await assertPreselected("#create-session", "");
  await closeCreate(page);
  await showSidebar(page);
  await page.locator('#management-view-switch input[value="instances"] + label').click();
  await assertPreselected('[data-action="create-session"][data-target="fixture"]', "");
  await closeCreate(page);
  await openProjectView(page);
}
