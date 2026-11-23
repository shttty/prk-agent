import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { settingsNavigation } from "./remote-extension-ui/settings-navigation.mjs";

const evidence = process.env.PI_TEST_WEB_EVIDENCE ? resolve(process.env.PI_TEST_WEB_EVIDENCE) : await mkdtemp(join(tmpdir(), "prk-plugrow-shots-"));
await mkdir(evidence, { recursive: true });
const local = { source: "/home/probe/plugins/pi-probe-compat-todolist", name: "pi-probe-compat-todolist", sourceKind: "local", sourceDisplay: "~/plugins/pi-probe-compat-todolist", version: "0.0.1" };
const packages = [local,
  { source: "npm:@probe/plugin@^2", name: "@probe/plugin", sourceKind: "npm", sourceDisplay: "@probe/plugin@^2", version: "2.3.4" },
  { source: "git:github.com/probe/plugin", name: "git-probe", sourceKind: "git", sourceDisplay: "github.com/probe/plugin" },
  // source === name used to suppress the source row altogether.
  { source: "/owned/unversioned", name: "/owned/unversioned", sourceKind: "local", sourceDisplay: "/owned/unversioned" },
].map((pkg) => ({ ...pkg, enabled: true, location: "gateway", commands: [], providerIds: [], providerErrors: [], warnings: [] }));
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  const { page, context, problems } = await openMockWorkbench(browser, server.url, {
    routes: { "/api/plugins": () => ({ packages, restartRequired: false }) },
  });
  await settingsNavigation(page).openSettings("plugins");
  await page.locator('#plugins-manager[aria-busy="false"]').waitFor();
  for (const pkg of packages) {
    const row = page.locator(`[data-plugin-source="${pkg.source}"]`);
    const source = row.locator(`[data-source-kind="${pkg.sourceKind}"]`);
    assert.equal(await source.isVisible(), true);
    assert.equal((await source.textContent()).endsWith(` · ${pkg.sourceDisplay}`), true);
    if (pkg.version) {
      const version = row.locator(`[data-plugin-version="${pkg.version}"]`);
      assert.equal(await version.isVisible(), true);
      assert.equal(await version.textContent(), pkg.version);
      assert.equal(await version.evaluate((el) => getComputedStyle(el).color !== getComputedStyle(el.parentElement).color), true);
    } else assert.equal(await row.locator("[data-plugin-version]").count(), 0);
  }
  await page.screenshot({ path: join(evidence, "plugins-desktop.png"), fullPage: true });
  assert.deepEqual(problems, []);
  await context.close();
  console.log(`PASS plugin row browser: source kinds, displayed values, optional secondary-color versions; screenshot ${join(evidence, "plugins-desktop.png")}`);
} finally {
  await browser.close();
  await server.close();
}
