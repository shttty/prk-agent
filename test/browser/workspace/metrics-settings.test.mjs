import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { freePort } from "../../fixtures/free-port.mjs";
import { until } from "../../fixtures/until.mjs";

const scrapes = async (port) => (await fetch(`http://127.0.0.1:${port}/metrics`).catch(() => undefined))?.status === 200;

test("the debug section switches the Gateway metrics endpoint and changes its port without a restart", async (t) => {
  const [first, second] = [await freePort(), await freePort()];
  const f = await browserFixture(t, { serveMetrics: true, config: { metrics: { port: first } } });
  const busy = await freePort();
  const occupant = createServer();
  await new Promise((resolve) => occupant.listen(busy, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => occupant.close(resolve)));
  const saves = [];
  f.page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/api/settings/metrics")) saves.push(request.postData()); });

  await f.open(await f.create());
  await f.page.locator("#open-settings").click();
  const enabled = f.page.locator("#setting-metrics-enabled");
  const port = f.page.locator("#setting-metrics-port");
  const url = f.page.locator("#metrics-url");
  const error = f.page.locator("#metrics-error");
  await url.waitFor();
  assert.equal(await enabled.isChecked(), true);
  assert.equal(await port.inputValue(), String(first));
  assert.equal(await url.innerText(), `http://127.0.0.1:${first}/metrics`);

  await f.page.locator('label.pi-settings-title[for="setting-metrics-enabled"]').click();
  await url.waitFor({ state: "detached" });
  assert.equal(await enabled.isChecked(), false);
  assert.equal(await scrapes(first), false, "switching off closes the listener");
  await f.page.locator('label.pi-settings-title[for="setting-metrics-enabled"]').click();
  await url.waitFor();
  assert.equal(await scrapes(first), true, "switching on serves again");

  await port.fill(String(second));
  await port.press("Enter");
  await f.page.locator("#metrics-url", { hasText: String(second) }).waitFor();
  assert.equal(await scrapes(first), false);
  assert.equal(await scrapes(second), true);

  await port.fill(String(busy));
  await port.press("Enter");
  await error.waitFor();
  await until(async () => await port.inputValue() === String(second), "the port field returns to the running port");
  assert.equal(await url.innerText(), `http://127.0.0.1:${second}/metrics`);
  assert.equal(await scrapes(second), true, "a failed change keeps the old listener");

  const requests = saves.length;
  await port.fill("80");
  await port.press("Enter");
  await until(async () => await port.inputValue() === String(second), "an invalid port is not sent");
  assert.equal(saves.length, requests);
  await error.waitFor();

  await f.page.locator("#close-settings").click();
  await f.page.locator("#open-settings").click();
  await f.page.locator("#metrics-url", { hasText: String(second) }).waitFor();
  assert.equal(await f.page.locator("#setting-metrics-port").inputValue(), String(second));
});
