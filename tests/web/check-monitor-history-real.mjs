import { parse } from "smol-toml";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { withMonitorHistoryFixture } from "../fixtures/monitor-history-fixture.mjs";

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(check, label) {
  const deadline = Date.now() + 20000;
  while (!await check()) {
    assert(Date.now() < deadline, `Timed out: ${label}`);
    await sleep(40);
  }
}
for (const key of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) assert(process.env[key], `${key} required`);
const shots = process.env.PI_TEST_WEB_EVIDENCE;
if (shots) await mkdir(shots, { recursive: true });
await withMonitorHistoryFixture(async ({ host, client, ui, provider, first, second, counter, home, instances }) => {
  host.monitorFocus(first, true);
  await until(() => host.monitorHistory(first).customMetrics.find(({ name }) => name === "temperature")?.samples.length >= 3, "target command history seeded");
  host.monitorFocus(first, false);
  const saved = await client.request("getTarget", { target: "fixture" });
  const { customMetrics, ...connectionSettings } = saved;
  const globalConfig = await readFile(join(home, "config.toml"), "utf8");
  await client.request("editTarget", { target: connectionSettings });
  assert.deepEqual(structuredClone(parse(await readFile(join(home, "instances.toml"), "utf8"))).instances[0].customMetrics, instances.instances[0].customMetrics, "connection saves preserve custom definitions");
  assert.equal(await readFile(join(home, "config.toml"), "utf8"), globalConfig, "instance edits leave global configuration unchanged");
  assert.equal(customMetrics.length, 3);
  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  const browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"], ignoreDefaultArgs: ["--hide-scrollbars"] });
  const problems = [];
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 }, colorScheme: "dark", isMobile: mobile, hasTouch: mobile });
      await context.addInitScript(() => localStorage.setItem("pi-session-theme", "dark"));
      const page = await context.newPage();
      page.on("pageerror", (error) => problems.push(error.message));
      const requests = [];
      page.on("request", (request) => {
        if (request.url().endsWith("/monitor/history")) requests.push("history");
        if (request.url().endsWith("/monitor/focus") && request.postDataJSON()?.open) requests.push("focus");
      });
      const select = async (name) => {
        if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
        await page.locator(`[data-session-id="${name}"] .management-session-select`).click();
        await page.locator("#composer").waitFor();
      };
      const open = async () => {
        if (await page.locator("#toggle-monitor").getAttribute("aria-pressed") !== "true") await page.locator("#toggle-monitor").click();
        await page.locator('#monitor-custom [data-metric="temperature"] .pi-chart').waitFor();
        await page.locator('#monitor-custom [data-metric="invalid"][data-status="error"]').waitFor();
      };
      await page.goto(ui.url);
      await select(first);
      await open();
      assert.equal(await page.locator("#monitor-machine").getAttribute("data-window-ms"), "60000");
      assert.equal(await page.locator('#monitor-custom [data-metric="queue"]').getAttribute("data-status"), "ok");
      const initial = await page.locator('#monitor-custom [data-metric="temperature"]').getAttribute("data-first-at");
      const cpuAt = await page.locator("#monitor-cpu").getAttribute("data-first-at");
      assert(Number(initial) > 0 && Number(cpuAt) > 0);
      assert.deepEqual(requests.slice(0, 2), ["history", "focus"], "history arrives before fast/custom sampling begins");
      await page.reload();
      await select(first);
      await open();
      assert.equal(await page.locator('#monitor-custom [data-metric="temperature"]').getAttribute("data-first-at"), initial, "custom history survives page reload");
      assert.equal(await page.locator("#monitor-cpu").getAttribute("data-first-at"), cpuAt, "machine history survives page reload");
      await select(second);
      await open();
      assert.equal(await page.locator('#monitor-custom [data-metric="temperature"]').getAttribute("data-first-at"), initial, "switching sessions shares the instance's previous samples");
      const n = await page.locator('#monitor-custom [data-metric="temperature"]').getAttribute("data-points");
      await page.waitForFunction((before) => Number(document.querySelector('#monitor-custom [data-metric="temperature"]').dataset.points) > Number(before), n);
      const machinePoints = Number(await page.locator("#monitor-cpu").getAttribute("data-points"));
      const collectedPoints = host.monitorHistory(second).machine.filter(({ value }) => Number.isFinite(value.cpu?.pct)).length;
      assert(machinePoints <= collectedPoints, "repeated machine samples in custom-result frames do not add duplicate chart points");
      if (shots) await page.screenshot({ path: join(shots, `monitor-${mobile ? "phone" : "desktop"}-dark.png`), fullPage: true });
      if (!mobile) {
        await page.locator('[data-action="instance-menu"][data-target="fixture"]').click();
        await page.locator('[data-action="instance-settings"][data-target="fixture"]').click();
        await page.locator('#instance-custom-metrics[data-count="3"]').waitFor();
        assert.equal(await page.locator('#instance-custom-metrics [data-metric="temperature"] input').count(), 0);
        await page.keyboard.press("Escape");
        await page.locator("#toggle-monitor").click();
        await page.locator("#monitor-card").waitFor({ state: "detached" });
        assert.equal(await page.locator("#toggle-monitor").getAttribute("aria-pressed"), "false");
        assert.equal(await page.locator("#monitor-card").count(), 0);
        assert.equal(await page.locator(".pi-chatcol").getAttribute("data-monitor"), "chip");
        await sleep(700);
        const folded = (await readFile(counter)).length;
        await sleep(1300);
        assert.equal((await readFile(counter)).length, folded, "folding releases the live collection lease");
        await page.reload();
        await select(second);
        await page.locator("#toggle-monitor").waitFor();
        assert.equal(await page.locator("#toggle-monitor").getAttribute("aria-pressed"), "false");
        assert.equal(await page.locator("#monitor-card").count(), 0, "folded state survives reload");
        await open();
        assert.equal(await page.locator('#monitor-custom [data-metric="temperature"]').getAttribute("data-first-at"), initial, "unfolding restores Gateway history instead of starting over");
        await until(async () => (await readFile(counter)).length > folded, "unfolding reacquires the collection lease");
      }
      await page.locator("#toggle-monitor").click();
      await sleep(700);
      const closed = (await readFile(counter)).length;
      await sleep(1300);
      assert.equal((await readFile(counter)).length, closed, "actual browser card close stops target-side command launches");
      await page.reload();
      await select(second);
      assert.equal(await page.locator("#toggle-monitor").getAttribute("aria-pressed"), "false");
      assert.equal(await page.locator(".pi-monitor-panel").count(), 0, "closed state survives reload");
      if (!mobile) {
        assert.equal(await page.locator(".pi-chatcol").getAttribute("data-monitor"), "chip", "a closed panel leaves only the button");
        assert.equal(await page.locator("#transcript").evaluate((node) => getComputedStyle(node).paddingRight), "0px", "and reserves no chat width");
      }
      await open();
      assert.equal(await page.locator('#monitor-custom [data-metric="temperature"]').getAttribute("data-first-at"), initial, "reopening restores the same instance history");
      await page.locator("#toggle-monitor").click();
      await context.close();
      console.log(`PASS real ${mobile ? "phone" : "desktop"}: history before focus, refresh/session continuity, custom curves/error, live updates, close counter ${closed}`);
    }
    assert.deepEqual(problems, []);
    assert.equal(provider.state.callCount, 0);
    console.log("PASS real monitor browser: zero pageerrors, zero model calls, settings list and save preservation");
  } finally { await browser.close(); }
});
