import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createDerivationMock } from "../fixtures/subsessions-ui/create-derivation-mock.mjs";
import { DEFAULT_INSTRUCTIONS } from "../fixtures/subsessions-ui/create-derivation-mock.mjs";
import { MODELS } from "../fixtures/subsessions-ui/create-derivation-mock.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { assertUniqueIds } from "../fixtures/workspace-mock/assert-unique-ids.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { DEFAULT_DERIVATION_ROLES } from "../../src/config/derivation/derivation-types.ts";
import { checkBuiltinRoleEditing } from "../fixtures/subsessions-ui/check-builtin-role-editing.mjs";
import { checkCustomRoleEditing } from "../fixtures/subsessions-ui/check-custom-role-editing.mjs";

const shotsDir = process.env.PI_TEST_WEB_EVIDENCE || ".smart-cascade/control/subsession-settings-ui";
await mkdir(shotsDir, { recursive: true });

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();

try {
  // 1. Desktop light: full interactive flow + overview-light and role-editor-light screenshots
  {
    const mock = createDerivationMock();
    const { context, page, problems } = await openMockWorkbench(browser, server.url, {
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      mobile: false,
      models: MODELS,
      beforeGoto: mock.beforeGoto,
    });
    page.setDefaultTimeout(15000);

    await page.locator("#open-settings").click();
    await page.locator("#open-subsessions").click();
    await page.locator('[data-section="derivation-defaults"]').waitFor();
    await page.locator('[data-section="derivation-roles"]').waitFor();
    await assertUniqueIds(page, "subsessions-initial");

    assert.equal(await page.locator("#derivation-default-tool-mode").inputValue(), "");
    assert.equal(await page.locator("#derivation-default-isolated").isChecked(), false);
    assert.equal(await page.locator("#derivation-max-depth").inputValue(), "3");
    assert.equal(await page.locator("#derivation-default-model, #derivation-default-thinking").count(), 0);
    assert.equal(await page.locator("#derivation-default-instructions").inputValue(), DEFAULT_INSTRUCTIONS);
    assert.deepEqual(mock.getDerivation().roles, DEFAULT_DERIVATION_ROLES);
    for (const name of Object.keys(DEFAULT_DERIVATION_ROLES)) {
      const row = page.locator(`[data-role-row="${name}"][data-builtin="true"]`);
      await row.waitFor();
      assert.equal(await row.locator('[data-action="delete-role"]').count(), 0);
    }

    await page.locator("#derivation-default-tool-mode").selectOption("direct");
    await page.locator("#derivation-default-isolated").click({ force: true });
    assert.equal(await page.locator("#derivation-default-isolated").isChecked(), true);
    await page.locator("#derivation-max-depth").selectOption("5");

    await page.locator("#derivation-default-instructions").fill("Temporary custom instructions.");
    await page.locator("#reset-derivation-instructions").click();
    assert.equal(await page.locator("#derivation-default-instructions").inputValue(), DEFAULT_INSTRUCTIONS);
    const customInstructions = "Focus on your assigned slice and report concise evidence via session_result.";
    await page.locator("#derivation-default-instructions").fill(customInstructions);

    await page.locator("#save-derivation-defaults").click();
    await page.locator('#derivation-defaults-status[data-status="saved"]').waitFor();
    assert.equal(mock.posts.length, 1);
    assert.deepEqual(mock.posts[0], {
      derivation: {
        defaultToolMode: "direct",
        defaultIsolated: true,
        maxDepth: 5,
        defaultInstructions: customInstructions,
        roles: DEFAULT_DERIVATION_ROLES,
      },
    });

    assert.equal(await page.locator('[data-role-row][data-builtin="true"]').count(), Object.keys(DEFAULT_DERIVATION_ROLES).length);
    await checkBuiltinRoleEditing({ page, mock });
    const savedBuiltinRoles = structuredClone(mock.getDerivation().roles);
    await checkCustomRoleEditing({ page, mock, shotsDir });
    assert.deepEqual(mock.getDerivation().roles, savedBuiltinRoles, "Custom deletion preserves every builtin override");
    assert.equal(await page.locator('[data-empty="roles"]').count(), 0);
    assert.equal(await page.locator('[data-role-row][data-builtin="true"]').count(), Object.keys(DEFAULT_DERIVATION_ROLES).length);
    assert.equal(mock.getCapabilityGets(), 1);
    for (const { derivation } of mock.posts) {
      assert.equal(Object.hasOwn(derivation, "defaultModel"), false);
      assert.equal(Object.hasOwn(derivation, "defaultThinkingLevel"), false);
    }
    await page.reload();
    await page.locator("#open-settings").click();
    await page.locator("#open-subsessions").click();
    await page.locator('[data-section="derivation-defaults"]').waitFor();
    assert.equal(await page.locator("#derivation-default-model, #derivation-default-thinking").count(), 0);
    assert.equal(await page.locator("#derivation-default-instructions").inputValue(), customInstructions);
    for (const name of Object.keys(DEFAULT_DERIVATION_ROLES)) {
      const row = page.locator(`[data-role-row="${name}"][data-builtin="true"]`);
      await row.waitFor();
      assert.equal(await row.locator('[data-action="delete-role"]').count(), 0);
      assert.equal(await row.locator('[data-field="model"]').getAttribute("data-model"), savedBuiltinRoles[name].model);
      assert.equal(await row.locator('[data-field="model"]').getAttribute("data-thinking"), savedBuiltinRoles[name].thinkingLevel);
      assert.equal(await row.locator('[data-field="capabilities"]').getAttribute("data-override-count"), "2");
    }
    assert.equal(await page.locator('[data-role-row="scout"]').count(), 0);
    assert.deepEqual(problems, []);
    await context.close();
    console.log("PASS desktop-light");
  }

  // 2. Desktop dark + Phone light + Phone dark
  const seededRoles = {
    scout: {
      description: "Fast read-only codebase exploration and search",
      model: "clp/claude-sonnet-5-5",
      thinkingLevel: "high",
      toolMode: "direct",
      isolated: false,
      instructions: "Read-only scout: inspect files and return findings without editing.",
      capabilities: { "lazy:tool:probe_search": true, "tool:write": false },
    },
  };

  for (const [tag, viewport, colorScheme, mobile] of [
    ["desktop-dark", { width: 1440, height: 900 }, "dark", false],
    ["phone-light", { width: 390, height: 844 }, "light", true],
    ["phone-dark", { width: 390, height: 844 }, "dark", true],
  ]) {
    const mock = createDerivationMock(seededRoles);
    const { context, page, problems } = await openMockWorkbench(browser, server.url, {
      viewport,
      colorScheme,
      mobile,
      models: MODELS,
      beforeGoto: mock.beforeGoto,
    });
    page.setDefaultTimeout(15000);
    if (mobile) await page.locator("#open-sidebar").click();
    await page.locator("#open-settings").click();
    await page.locator("#open-subsessions").click();
    await page.locator('[data-section="derivation-defaults"]').waitFor();
    await page.locator('[data-role-row="scout"]').waitFor();
    assert.equal(await page.locator("#derivation-default-model, #derivation-default-thinking").count(), 0);
    for (const name of Object.keys(DEFAULT_DERIVATION_ROLES)) {
      const row = page.locator(`[data-role-row="${name}"][data-builtin="true"]`);
      await row.waitFor();
      assert.equal(await row.locator('[data-action="delete-role"]').count(), 0);
    }
    await assertUniqueIds(page, `${tag}-overview`);

    if (tag === "desktop-dark") {
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(shotsDir, "subsessions-overview-dark.png"), animations: "disabled" });
    }

    await page.locator('[data-role-row="scout"] [data-action="edit-role"]').click();
    await page.locator("#derivation-role-editor").waitFor();
    await assertUniqueIds(page, `${tag}-role-editor`);
    assert.equal(await page.locator("#role-name").isDisabled(), false);
    assert.equal(await page.locator("#role-model").inputValue(), seededRoles.scout.model);
    assert.equal(await page.locator("#role-thinking").inputValue(), seededRoles.scout.thinkingLevel);

    if (tag === "phone-dark") {
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(shotsDir, "subsessions-role-editor-phone-dark.png"), animations: "disabled" });
    }

    await page.locator("#cancel-derivation-role").click();
    await page.locator('[data-role-row="scout"]').waitFor();
    await page.locator('[data-role-row="small"] [data-action="edit-role"]').click();
    await page.locator("#derivation-role-editor").waitFor();
    assert.equal(await page.locator("#role-name").isDisabled(), true);
    assert.equal(await page.locator("#role-model").isDisabled(), false);
    assert.equal(await page.locator("#role-tool-mode").inputValue(), DEFAULT_DERIVATION_ROLES.small.toolMode);
    await page.locator("#cancel-derivation-role").click();
    assert.deepEqual(problems, []);
    await context.close();
    console.log(`PASS ${tag}`);
  }
} finally {
  await browser.close();
  await server.close();
}
