import assert from "node:assert/strict";
import { openCreate } from "./open-create.mjs";
import { dialogClosed } from "./dialog-closed.mjs";
import { showSidebar } from "./show-sidebar.mjs";

export async function checkCreateProjects(page, { existing, newName, requests }) {
  const selector = page.locator("#management-dialog [data-project-selector]");
  const createAndCapture = async (choose) => {
    await openCreate(page, "#create-session");
    await page.locator("#confirm-create-session:not([disabled])").waitFor();
    await choose();
    const created = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/sessions" && response.request().method() === "POST");
    await page.locator("#confirm-create-session").click();
    const { session } = await (await created).json();
    await dialogClosed(page);
    return session;
  };
  const inExisting = await createAndCapture(async () => {
    await page.locator("#project-choice-select").click();
    await page.locator(`[data-project-option="${existing.id}"]`).click();
    assert.equal(await selector.getAttribute("data-selected"), existing.id);
  });
  assert.equal(inExisting.projectId, existing.id);
  assert.equal(inExisting.projectName, existing.name);
  const inNew = await createAndCapture(async () => {
    await page.locator('[data-action="new-project"]').click();
    const name = page.locator("#new-project-name");
    const confirm = page.locator('[data-action="confirm-new-project"]');
    const mark = requests.mark();
    for (const invalid of ["   ", ` ${existing.name} `]) {
      await name.fill(invalid);
      await confirm.click();
      await page.locator("#new-project-error").waitFor();
      assert.equal(requests.since(mark, "POST", "/api/sessions"), 0);
    }
    await name.fill(newName);
    await confirm.click();
    await name.waitFor({ state: "hidden" });
    assert.equal(await selector.getAttribute("data-new-name"), "true");
    assert.equal(requests.since(mark, "POST", "/api/sessions"), 0);
  });
  assert.equal(inNew.projectName, newName);
  assert(inNew.projectId && inNew.projectId !== existing.id, "The Gateway gives the new project its own id");
  await showSidebar(page);
  await page.locator(`.management-group[data-group="${existing.id}"] [data-session-id="${inExisting.sessionId}"]`).waitFor({ state: "attached" });
  await page.locator(`.management-group[data-group="${inNew.projectId}"] [data-session-id="${inNew.sessionId}"]`).waitFor({ state: "attached" });
}
