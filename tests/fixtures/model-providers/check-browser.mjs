import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startWebDev } from "../web-dev.mjs";

export async function checkProviderBrowser(api, sessionId, evidence) {
  if (!process.env.PI_TEST_PLAYWRIGHT || !process.env.PI_TEST_CHROMIUM) throw new Error("Provider UI acceptance requires PI_TEST_PLAYWRIGHT and PI_TEST_CHROMIUM");
  const { chromium } = await import(process.env.PI_TEST_PLAYWRIGHT);
  const ui = await startWebDev(api);
  const browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
  try {
    const response = await fetch(`${api}/api/sessions/${encodeURIComponent(sessionId)}/native`);
    assert.equal(response.status, 200);
    const native = await response.json();
    const denial = native.resources.find((resource) => resource.code === "PROVIDER_POLICY" && resource.loaded);
    assert.ok(denial?.reason, "a loaded plugin exposes the actual rejected provider diagnostic");
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(ui.url);
    const row = page.locator(`[data-session-id="${sessionId}"]`);
    await row.locator(".management-session-select").click();
    await page.locator('#composer').waitFor();
    await row.locator('[data-action="session-menu"]').click();
    await page.locator("#session-details").click();
    const provider = page.locator('[data-resource-type="extension"][data-resource-providers*="gateway-fixture"]');
    await provider.first().waitFor();
    const policy = page.locator('[data-resource-code="PROVIDER_POLICY"]');
    await policy.first().waitFor();
    assert.ok(await provider.count() >= 1);
    assert.ok(await policy.count() >= 1);
    await provider.first().scrollIntoViewIfNeeded();
    assert.equal(await policy.first().getAttribute("data-resource-name"), denial.name);
    assert.ok((await policy.first().textContent()).includes(denial.reason), "the loaded plugin's actual provider rejection reason is visible");
    if (evidence) {
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: join(evidence, "provider-resources.png"), animations: "disabled" });
    }
    await page.locator("#close-session-details").click();
    await page.locator("#open-settings").click();
    await page.locator('[data-settings-section="tools"]').click();
    await page.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor();
    const globalErrors = page.locator('[data-field="provider-error"][data-code="PROVIDER_POLICY"]');
    await globalErrors.first().waitFor();
    assert.ok(await globalErrors.count() >= 1);
    assert.ok(await page.locator('[data-field="provider-error"][data-provider-id="clp"]').count() >= 1);
    if (evidence) await page.screenshot({ path: join(evidence, "provider-capability-errors.png"), animations: "disabled" });
    assert.deepEqual(errors, []);
    console.log("PASS provider browser: actual resource provider labels, retained extension diagnostics and global capability errors; pageerrors=0");
  } finally { await browser.close(); await ui.close(); }
}
