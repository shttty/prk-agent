import assert from "node:assert/strict";

export async function checkInstanceAvailability({ browser, ui }) {
    // instanceError: a provider discovery failure keeps the page usable and shows above the remaining switches.
    {
      const { installInstanceMock, instanceMock } = await import("../instance-settings-mock.mjs");
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(15000);
      const { capabilityPosts } = await installInstanceMock(page);
      await page.goto(ui.url);
      await page.locator(`[data-group="${instanceMock.failing}"] [data-action="instance-menu"]`).click();
      await page.locator(`[data-action="instance-settings"][data-target="${instanceMock.failing}"]`).click();
      await page.locator('#instance-settings [data-instance-tab="tools"]').click();
      await page.locator('#instance-settings .capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor();
      await page.locator("#instance-settings #instance-error").waitFor();
      await page.locator('#instance-settings [data-provider="group:tools:package:panel-fixture"] .capability-provider-name').click();
      await page.locator(`#instance-settings [data-capability="${instanceMock.tool.id}"] [data-stop="off"]`).click();
      await page.locator(`#instance-settings [data-capability="${instanceMock.tool.id}"] [data-overridden="true"]`).waitFor();
      assert.deepEqual(capabilityPosts, [{ instance: instanceMock.failing, changes: [{ id: instanceMock.tool.id, enabled: false }] }], "the other switches still work");
      assert.deepEqual(errors, [], "instanceError page: zero pageerror");
      await context.close();
      console.log("PASS instance settings (mock): instanceError line, switches stay usable; pageerrors=0");
    }

    // First load: the instance catalog is slow, so the panel shows a loading state instead of source counts.
    {
      const { installInstanceMock, instanceMock } = await import("../instance-settings-mock.mjs");
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(15000);
      await installInstanceMock(page);
      await page.route("**/api/capabilities?instance=*", async (route) => { await new Promise((resolve) => setTimeout(resolve, 1000)); await route.fallback(); });
      await page.goto(ui.url);
      await page.locator(`[data-group="${instanceMock.instance}"] [data-action="instance-menu"]`).click();
      await page.locator(`[data-action="instance-settings"][data-target="${instanceMock.instance}"]`).click();
      await page.locator('#instance-settings [data-instance-tab="skills"]').click();
      const panel = page.locator('#instance-settings .capabilities-panel[data-kind="skills"]');
      await panel.locator('[data-status="loading"]').first().waitFor();
      assert.equal(await panel.locator("[data-count]").count(), 0, "no counts while the first load is pending");
      await panel.locator('[data-status="loading"]').first().waitFor({ state: "detached" });
      await panel.locator('[data-provider="group:skills:global"]').waitFor();
      assert.equal(await panel.locator('.capability-providers-stat [data-count="2"]').count(), 1, "counts show once loaded");
      assert.deepEqual(errors, [], "first load: zero pageerror");
      await context.close();
      console.log("PASS instance settings (mock): loading state until the first response; pageerrors=0");
    }

    // Instance refresh: the same button as the global page, posts only the instance, replaces the data.
    {
      const { installInstanceMock, instanceMock } = await import("../instance-settings-mock.mjs");
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.setDefaultTimeout(15000);
      const { refreshPosts } = await installInstanceMock(page);
      await page.route("**/api/capabilities/refresh", async (route) => { await new Promise((resolve) => setTimeout(resolve, 600)); await route.fallback(); });
      await page.goto(ui.url);
      await page.locator(`[data-group="${instanceMock.instance}"] [data-action="instance-menu"]`).click();
      await page.locator(`[data-action="instance-settings"][data-target="${instanceMock.instance}"]`).click();
      await page.locator('#instance-settings [data-instance-tab="skills"]').click();
      const panel = page.locator('#instance-settings .capabilities-panel[data-kind="skills"]');
      const stat = panel.locator(".capability-providers-stat [data-count]");
      await stat.waitFor();
      assert.equal(await stat.getAttribute("data-count"), "2");
      const refresh = panel.locator('[data-action="refresh-capabilities"]');
      await refresh.click();
      await panel.locator('[data-action="refresh-capabilities"][aria-busy="true"]').waitFor();
      await panel.locator('[data-action="refresh-capabilities"][aria-busy="false"]').waitFor();
      assert.deepEqual(refreshPosts, [{ instance: instanceMock.instance }], "refresh posts exactly the instance");
      await panel.locator('.capability-providers-stat [data-count="3"]').waitFor();
      assert.deepEqual(errors, [], "instance refresh: zero pageerror");
      await context.close();
      console.log("PASS instance settings (mock): refresh button posts the instance, spinner, data replaced; pageerrors=0");
    }
}
