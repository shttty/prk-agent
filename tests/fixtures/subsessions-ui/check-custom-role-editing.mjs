import assert from "node:assert/strict";
import { join } from "node:path";
import { assertUniqueIds } from "../workspace-mock/assert-unique-ids.mjs";

export async function checkCustomRoleEditing({ page, mock, shotsDir }) {
  await page.locator("#add-derivation-role").click();
  await page.locator("#derivation-role-editor").waitFor();
  await assertUniqueIds(page, "subsessions-role-editor");
  assert.equal(await page.locator("#role-name").isDisabled(), false);
  await page.locator("#role-name").fill("scout");
  await page.locator("#role-description").fill("Fast read-only codebase exploration and search");
  await page.locator("#role-tool-mode").selectOption("direct");
  await page.locator("#role-isolated").selectOption("false");
  await page.locator("#role-model").selectOption("clp/claude-sonnet-5-5");
  const roleThinkingValues = await page.locator("#role-thinking option").evaluateAll((nodes) => nodes.map((n) => n.value));
  assert.deepEqual(roleThinkingValues, ["", "off", "high"]);
  await page.locator("#role-thinking").selectOption("high");
  await page.locator("#role-instructions").fill("Read-only scout: inspect files and return findings without editing.");

  const probeRow = page.locator('#role-capabilities [data-capability="tool:probe_search"]');
  assert.equal(await probeRow.locator(".capability-mode").getAttribute("data-mode"), "resident");
  assert.equal(await probeRow.locator('[data-action="restore-role-capability"]').count(), 0);
  await probeRow.locator('[data-stop="lazy"]').click();
  assert.equal(await probeRow.locator(".capability-mode").getAttribute("data-mode"), "lazy");
  await probeRow.locator('[data-action="restore-role-capability"]').waitFor();
  await probeRow.locator('[data-action="restore-role-capability"]').click();
  assert.equal(await probeRow.locator(".capability-mode").getAttribute("data-mode"), "resident");
  assert.equal(await probeRow.locator('[data-action="restore-role-capability"]').count(), 0);
  await probeRow.locator('[data-stop="lazy"]').click();
  assert.equal(await probeRow.locator(".capability-mode").getAttribute("data-mode"), "lazy");
  const writeRow = page.locator('#role-capabilities [data-capability="tool:write"]');
  await writeRow.locator('[data-stop="off"]').click();
  assert.equal(await writeRow.locator(".capability-mode").getAttribute("data-mode"), "off");
  await writeRow.locator('[data-action="restore-role-capability"]').waitFor();

  await page.locator("#role-capabilities-tab-skills").click();
  const skillRow = page.locator('#role-capabilities [data-capability="skill:/home/user/.agents/skills/code-review/SKILL.md"]');
  await skillRow.waitFor();
  await skillRow.locator('[data-action="toggle-capability"]').click({ force: true });
  await skillRow.locator('[data-action="restore-role-capability"]').waitFor();
  await skillRow.locator('[data-action="restore-role-capability"]').click();
  assert.equal(await skillRow.locator('[data-action="restore-role-capability"]').count(), 0);
  await page.locator("#role-capabilities-tab-tools").click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(shotsDir, "subsessions-role-editor-light.png"), animations: "disabled" });
  await page.locator("#save-derivation-role").click();
  const scoutRow = page.locator('[data-role-row="scout"]');
  await scoutRow.waitFor();
  assert.equal(await scoutRow.getAttribute("data-builtin"), null);
  assert.equal(await scoutRow.locator('[data-action="delete-role"]').count(), 1);
  assert.equal(await scoutRow.locator('[data-field="tool-mode"]').getAttribute("data-tool-mode"), "direct");
  assert.equal(await scoutRow.locator('[data-field="isolated"]').getAttribute("data-isolated"), "false");
  assert.equal(await scoutRow.locator('[data-field="capabilities"]').getAttribute("data-override-count"), "2");
  assert.deepEqual(mock.getDerivation().roles.scout, {
    description: "Fast read-only codebase exploration and search", model: "clp/claude-sonnet-5-5", thinkingLevel: "high",
    toolMode: "direct", isolated: false, instructions: "Read-only scout: inspect files and return findings without editing.",
    capabilities: { "lazy:tool:probe_search": true, "tool:write": false },
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(shotsDir, "subsessions-overview-light.png"), animations: "disabled" });
  await scoutRow.locator('[data-action="edit-role"]').click();
  await page.locator("#derivation-role-editor").waitFor();
  assert.equal(await page.locator("#role-name").inputValue(), "scout");
  assert.equal(await page.locator("#role-name").isDisabled(), false);
  assert.equal(await page.locator("#role-model").inputValue(), "clp/claude-sonnet-5-5");
  assert.equal(await page.locator("#role-thinking").inputValue(), "high");
  const pluginGroup = page.locator('#role-capabilities [data-capability-group="group:tools:package:probe"]');
  await pluginGroup.locator('[data-stop="off"]').click();
  await pluginGroup.locator('[data-action="restore-role-capability"]').waitFor();
  const saved = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/derivation" && response.request().method() === "POST");
  await page.locator("#save-derivation-role").click();
  const response = await saved;
  assert.equal(response.status(), 200, await response.text());
  await scoutRow.waitFor();
  assert.equal(await scoutRow.locator('[data-field="capabilities"]').getAttribute("data-override-count"), "3");
  assert.deepEqual(mock.getDerivation().roles.scout.capabilities, {
    "lazy:tool:probe_search": true, "tool:write": false, "group:tools:package:probe": false,
  });
  await scoutRow.locator('[data-action="delete-role"]').click();
  await scoutRow.waitFor({ state: "detached" });
}
