import assert from "node:assert/strict";
import { DEFAULT_DERIVATION_ROLES } from "../../../src/config/derivation/derivation-types.ts";

export async function checkBuiltinRoleEditing({ page, mock }) {
  for (const [name, builtin] of Object.entries(DEFAULT_DERIVATION_ROLES)) {
    const row = page.locator(`[data-role-row="${name}"][data-builtin="true"]`);
    await row.waitFor();
    assert.equal(await row.locator('[data-action="delete-role"]').count(), 0);
    await row.locator('[data-action="edit-role"]').click();
    await page.locator("#derivation-role-editor").waitFor();
    assert.equal(await page.locator("#role-name").inputValue(), name);
    assert.equal(await page.locator("#role-name").isDisabled(), true, "Builtins cannot be renamed");
    for (const id of ["role-description", "role-model", "role-thinking", "role-tool-mode", "role-isolated", "role-instructions"]) {
      assert.equal(await page.locator(`#${id}`).isDisabled(), false, `${name}: ${id} remains editable`);
    }
    assert.equal(await page.locator("#role-description").inputValue(), builtin.description);
    await page.locator("#role-model").selectOption("clp/gpt-6.1-terra");
    const thinkingValues = await page.locator("#role-thinking option").evaluateAll((nodes) => nodes.map((node) => node.value));
    assert.deepEqual(thinkingValues, ["", "off", "medium"], "Model-specific thinking options live in the role editor");
    await page.locator("#role-thinking").selectOption("medium");
    const toolMode = builtin.toolMode === "direct" ? "code" : "direct";
    await page.locator("#role-tool-mode").selectOption(toolMode);
    await page.locator("#role-isolated").selectOption("false");
    await page.locator("#role-instructions").fill(`${name} role instructions`);
    assert.equal(await page.locator('#role-capabilities [data-capability-group="group:tools:local"] [data-stop]').count(), 0, "Role editors expose no unsupported local-tools master override");
    assert.equal(await page.locator('#role-capabilities [data-capability="tool:write"] [data-stop="off"]').isDisabled(), false, "Individual local-tool overrides remain editable");
    await page.locator('#role-capabilities [data-capability="tool:write"] [data-stop="off"]').click();
    await page.locator("#role-capabilities-tab-skills").click();
    const skill = page.locator('#role-capabilities [data-capability="skill:/home/user/.agents/skills/code-review/SKILL.md"]');
    await skill.locator('[data-action="toggle-capability"]').click({ force: true });
    await skill.locator('[data-action="restore-role-capability"]').waitFor();
    await page.locator("#save-derivation-role").click();
    await row.waitFor();
    assert.equal(await row.locator('[data-action="delete-role"]').count(), 0);
    assert.deepEqual(mock.getDerivation().roles[name], { ...builtin, model: "clp/gpt-6.1-terra", thinkingLevel: "medium",
      toolMode, isolated: false, instructions: `${name} role instructions`,
      capabilities: { "tool:write": false, "skill:/home/user/.agents/skills/code-review/SKILL.md": false } });
    await row.locator('[data-action="edit-role"]').click();
    await page.locator("#derivation-role-editor").waitFor();
    assert.equal(await page.locator("#role-name").isDisabled(), true);
    assert.equal(await page.locator("#role-model").inputValue(), "clp/gpt-6.1-terra");
    assert.equal(await page.locator("#role-thinking").inputValue(), "medium");
    assert.equal(await page.locator("#role-tool-mode").inputValue(), toolMode);
    assert.equal(await page.locator("#role-isolated").inputValue(), "false");
    assert.equal(await page.locator("#role-instructions").inputValue(), `${name} role instructions`);
    await page.locator("#cancel-derivation-role").click();
  }
}
