// Settings → 通用 → 重启 Gateway on the mock workbench: cancel posts nothing; confirm posts once and shows
// running → done; a failing API shows the failed state; no configured unit disables the button.
// Screenshots go to PI_TEST_WEB_EVIDENCE when set.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";

const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const unit = "prk-gateway.service";
const variants = [
  ["desktop-light", { width: 1440, height: 900 }, "light", false],
  ["desktop-dark", { width: 1440, height: 900 }, "dark", false],
  ["phone-dark", { width: 390, height: 844 }, "dark", true],
];

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  for (const [tag, viewport, colorScheme, mobile] of variants) {
    const posts = [];
    let mode = "ok";
    let release;
    const gate = () => new Promise((resolve) => { release = resolve; });
    let pending = gate();
    const routes = {
      "/api/gateway/restart": async (body) => {
        posts.push(body);
        await pending;
        if (mode === "fail") throw { status: 502, code: "SYSTEMCTL_FAILED", message: "systemctl restart failed: Unit not found." };
        return { unit, restarted: true, output: "" };
      },
    };
    const { context, page, problems } = await openMockWorkbench(browser, server.url, { viewport, colorScheme, mobile, ui: { gatewayRestartUnit: unit }, routes });
    page.setDefaultTimeout(15000);
    // Dialog and loader transitions finish before the picture is taken.
    const shot = async (name) => { if (!evidence) return; await page.waitForTimeout(500); await page.screenshot({ path: join(evidence, `gateway-restart-${name}-${tag}.png`), animations: "disabled" }); };
    if (mobile) await page.locator("#open-sidebar").click();
    await page.locator("#open-settings").click();
    await page.locator('[data-settings-section="general"]').click();
    const button = page.locator("#gateway-restart");
    await button.waitFor();
    assert.equal(await button.isEnabled(), true);
    assert.equal(await page.locator("#gateway-restart-note").count(), 0, `${tag}: configured unit shows no note`);
    await shot("idle");

    // Cancel: the dialog closes and nothing is posted.
    await button.click();
    await page.locator("#gateway-restart-cancel").waitFor();
    await page.locator("#gateway-restart-cancel").click();
    await page.locator("#gateway-restart-cancel").waitFor({ state: "detached" });
    assert.equal(posts.length, 0, `${tag}: cancel must not call the API`);

    // Confirm: one POST, running while it is in flight, then done.
    await button.click();
    await page.locator("#gateway-restart-cancel").waitFor();
    await shot("confirm");
    await page.locator("#gateway-restart-confirm").click();
    await page.locator('#gateway-restart[data-status="running"]').waitFor();
    assert.equal(await button.isDisabled(), true, `${tag}: no second request while running`);
    await shot("running");
    release();
    await page.locator('#gateway-restart-status[data-status="done"]').waitFor();
    assert.deepEqual(posts, [{}]);
    await shot("done");

    // Failure: the API error shows as the failed state and the button is usable again.
    mode = "fail"; pending = gate();
    await button.click();
    await page.locator("#gateway-restart-confirm").click();
    release();
    await page.locator('#gateway-restart-status[data-status="failed"]').waitFor();
    assert.equal(posts.length, 2);
    assert.equal(await button.isEnabled(), true);
    assert.equal(await page.locator('#gateway-restart-status[data-status="done"]').count(), 0, `${tag}: a failed retry clears the old success`);
    await shot("failed");
    assert.deepEqual(problems, [], `${tag}: page errors`);
    await context.close();
    console.log(`PASS ${tag}: cancel posts nothing, confirm → running → done, failure shown`);
  }

  // No unit configured: disabled with the reason, nothing can be posted.
  const posts = [];
  const { context, page, problems } = await openMockWorkbench(browser, server.url, { routes: { "/api/gateway/restart": async (body) => { posts.push(body); return {}; } } });
  page.setDefaultTimeout(15000);
  await page.locator("#open-settings").click();
  await page.locator('[data-settings-section="general"]').click();
  await page.locator("#gateway-restart-note[data-status='unconfigured']").waitFor();
  assert.equal(await page.locator("#gateway-restart").isDisabled(), true);
  if (evidence) await page.screenshot({ path: join(evidence, "gateway-restart-unconfigured-desktop-light.png"), animations: "disabled" });
  assert.equal(await page.locator("#gateway-restart-cancel").count(), 0);
  assert.deepEqual(posts, []);
  assert.deepEqual(problems, [], "unconfigured: page errors");
  await context.close();
  console.log("PASS unconfigured: button disabled with reason");
} finally {
  await browser.close();
  await server.close();
}
