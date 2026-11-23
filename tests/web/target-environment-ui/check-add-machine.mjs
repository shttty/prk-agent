import assert from "node:assert/strict";
import { join } from "node:path";
import { assertDeployFrames } from "./record-frames.mjs";

// Scenario 1, adding a machine: draft connection test and interpreter check deploy nothing; saving the complete instance
// starts the deploy and the editor stays open on its real progress until ready.
export async function checkAddMachine({ page, recorder, evidence, openSettings, api, connection, label }) {
  await openSettings("targets");
  await page.locator("#add-target").click();
  await page.locator("#target-label").fill(label);
  await page.locator("#target-ssh-command").fill(connection.sshCommand);
  await page.locator("#inspect-target").click();
  await page.locator('#target-inspection-feedback[data-state="success"]').waitFor({ timeout: 60000 });
  await page.locator("#target-python").fill(connection.python);
  await page.locator("#check-target-python").click();
  await page.locator('#target-python-check[data-state="success"]').waitFor({ timeout: 60000 });
  await page.locator("#target-cwd").fill(connection.cwd);
  assert.equal(recorder.posts.some((path) => path.endsWith("/environment")), false, "the draft checks deploy nothing");
  const saved = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/targets");
  await page.locator("#save-target").click();
  const answer = await saved;
  assert.equal(answer.status(), 200);
  const savedTargets = (await answer.json()).targets ?? [];
  const panel = page.locator("#target-environment");
  await panel.waitFor({ state: "visible" }).catch((error) => {
    throw new Error(`no environment panel after save; saved targets: ${JSON.stringify(savedTargets)}`, { cause: error });
  });
  const name = await panel.getAttribute("data-target");
  await page.locator('#target-environment .environment-progress[data-environment-status="transferring"]').waitFor({ timeout: 120000 });
  await page.screenshot({ path: join(evidence, "add-machine-transferring-desktop.png"), animations: "disabled" });
  await page.locator('#target-environment .environment-progress[data-environment-status="ready"]').waitFor({ timeout: 600000 });
  await page.screenshot({ path: join(evidence, "add-machine-ready-desktop.png"), animations: "disabled" });
  const frames = (await recorder.frames()).filter((frame) => frame.target === name);
  assertDeployFrames(assert, frames, "add machine");
  assert.equal(frames.at(-1).percent, 100);
  assert.equal(recorder.posts.some((path) => path === `/api/targets/${encodeURIComponent(name)}/environment`), false, "the save itself started the deploy");
  const held = await api(`/targets/${encodeURIComponent(name)}/environment`);
  assert.equal(held.status, "ready");
  await page.locator('[data-action="close-environment"]').click();
  await page.locator("#close-settings").click();
  return { name, frames: frames.length };
}
