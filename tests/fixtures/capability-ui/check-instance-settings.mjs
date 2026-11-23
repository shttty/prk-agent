import assert from "node:assert/strict";
import { join } from "node:path";

export async function checkInstanceSettings({ browser, ui, evidence, settled }) {
    // Contract PRK-SKILLS3 on mock data: one instance settings component behind two anchors (sidebar "…" and the
    // settings window's instance page); switches post the instance and restore sends null; instanceError shows on top.
    for (const [tag, width, height, colorScheme] of [["desktop-light", 1440, 960, "light"], ["desktop-dark", 1440, 960, "dark"], ["phone-light", 390, 844, "light"], ["phone-dark", 390, 844, "dark"]]) {
      const { installInstanceMock, instanceMock } = await import("../instance-settings-mock.mjs");
      const phone = width < 600;
      const context = await browser.newContext({ viewport: { width, height }, colorScheme, isMobile: phone, hasTouch: phone });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(15000);
      const { capabilityPosts, targetDeletes } = await installInstanceMock(page);
      await page.goto(ui.url);
      const { instance, failing, globalSkill, sharedSkill } = instanceMock;
      const root = (name) => page.locator(`#instance-settings[data-instance="${name}"]`);
      // Phone: the drawer stays open after a menu item that opens only a confirmation.
      const sidebar = async () => { if (phone && !await page.locator("aside.management-sidebar").isVisible()) await page.locator("#open-sidebar").click(); };
      const instanceMenu = async (name, action) => {
        await sidebar();
        await page.locator(`[data-group="${name}"] [data-action="instance-menu"]`).click();
        await page.locator(`[data-action="${action}"][data-target="${name}"]`).click();
      };
      const panelReady = (kind) => page.locator(`#instance-settings .capabilities-panel[data-kind="${kind}"][data-scope="instance"][aria-busy="false"]`).waitFor();
      const openTab = async (kind) => { await root(instance).locator(`[data-instance-tab="${kind}"]`).click(); await panelReady(kind); await settled(page); };
      // Rows of a provider show once it is chosen; on a phone the provider opens a sheet (outside the component's root) over the list.
      const scope = phone ? "#capability-sheet" : "#instance-settings";
      const skillSwitch = page.locator(`${scope} [data-capability="${globalSkill.id}"] [data-action="toggle-capability"]`);
      const skillRow = page.locator(`${scope} [data-capability="${globalSkill.id}"]`);
      const closeSheet = async () => { if (phone && await page.locator('.capability-layer[data-open="true"]').count()) await page.locator('#capability-sheet [data-action="close-provider"]').click(); };
      const showInstanceProvider = async (provider) => {
        await closeSheet();
        await page.locator(`#instance-settings [data-provider="${provider}"] .capability-provider-name`).click();
        if (phone) await page.waitForFunction(() => getComputedStyle(document.querySelector("#capability-sheet")).transform === "none");
        else await settled(page);
      };

      // Anchor 1: sidebar "…" → settings.
      await instanceMenu(instance, "instance-settings");
      await root(instance).waitFor();
      await openTab("skills");
      assert.deepEqual(await page.locator("#instance-settings #skills-sources [data-provider]").evaluateAll((nodes) => nodes.map((node) => node.dataset.provider)), ["group:skills:global", "group:skills:shared"], "the instance view lists only Gateway global and shared skill groups");
      assert.equal(await page.locator('#instance-settings [data-provider="group:skills:instance"]').count(), 0, "the instance panel has no target-home skill source");
      await showInstanceProvider("group:skills:global");
      assert.equal(await page.locator("#instance-settings #instance-error").count(), 0, "a reachable instance shows no error line");
      await skillSwitch.click({ force: true });
      await skillRow.locator('[data-overridden="true"]').waitFor();
      assert.deepEqual(capabilityPosts, [{ instance, changes: [{ id: globalSkill.id, enabled: false }] }], "a switch posts the instance with the id");
      assert.equal(await skillSwitch.isChecked(), false);
      // Phone: the shot shows the component's tabs and provider list, not the provider sheet.
      if (evidence) { await closeSheet(); await settled(page); await page.screenshot({ path: join(evidence, `instance-sidebar-${tag}.png`), animations: "disabled" }); await showInstanceProvider("group:skills:global"); }
      await skillRow.locator('[data-action="restore-default"]').click();
      await skillRow.locator('[data-overridden="true"]').waitFor({ state: "detached" });
      assert.deepEqual(capabilityPosts.at(-1), { instance, changes: [{ id: globalSkill.id, enabled: null }] }, "restore default sends enabled: null");
      assert.equal(await skillSwitch.isChecked(), true);
      await closeSheet();
      await page.locator("#close-instance-settings").click();
      await root(instance).waitFor({ state: "detached" });

      // Anchor 1: sidebar "…" → delete instance goes through a confirmation.
      await instanceMenu(failing, "delete-instance");
      await page.locator('#delete-instance-confirm [data-action="cancel-delete-instance"]').waitFor();
      assert.deepEqual(targetDeletes, [], "nothing is deleted before the confirmation");
      await page.locator('#delete-instance-confirm [data-action="cancel-delete-instance"]').click();
      await page.locator('#delete-instance-confirm [data-action="cancel-delete-instance"]').waitFor({ state: "detached" });
      assert.deepEqual(targetDeletes, []);
      await instanceMenu(failing, "delete-instance");
      await page.locator('#delete-instance-confirm [data-action="confirm-delete-instance"]').click();
      await page.locator(`[data-group="${failing}"]`).waitFor({ state: "detached" });
      assert.deepEqual(targetDeletes, [failing]);

      // Anchor 2: the settings window's instance page opens the same component.
      await sidebar();
      await page.locator("#open-settings").click();
      await page.locator('[data-settings-section="targets"]').click({ position: { x: 20, y: 20 } });
      await page.locator(`#settings-targets [data-action="open-instance-settings"][data-target="${instance}"]`).click();
      await root(instance).waitFor();
      await openTab("skills");
      await showInstanceProvider("group:skills:global");
      await skillSwitch.click({ force: true });
      await skillRow.locator('[data-overridden="true"]').waitFor();
      assert.deepEqual(capabilityPosts.at(-1), { instance, changes: [{ id: globalSkill.id, enabled: false }] }, "the settings window posts the same request");
      await showInstanceProvider("group:skills:shared");
      assert.equal(await page.locator(`${scope} [data-capability="${sharedSkill.id}"]`).count(), 1);
      if (evidence) { await closeSheet(); await settled(page); await page.screenshot({ path: join(evidence, `instance-settings-${tag}.png`), animations: "disabled" }); }
      await closeSheet();
      await page.locator('#settings-targets [data-action="close-instance-settings"]').click();
      await root(instance).waitFor({ state: "detached" });
      await page.locator(`#settings-targets [data-action="open-instance-settings"][data-target="${instance}"]`).waitFor();
      await page.locator("#close-settings").click();

      assert.deepEqual(errors, [], `${tag}: zero pageerror`);
      await context.close();
      console.log(`PASS instance settings ${tag} (mock): sidebar menu, switch/restore requests, delete confirmation, settings-window page; pageerrors=0`);
    }
}
