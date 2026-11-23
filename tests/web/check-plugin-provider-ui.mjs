// Provider ownership in the plugin list on a really bootstrapped Gateway (no injected ModelRuntime): the page installs a
// provider-owning local directory choosing the Gateway location; the Gateway restarts and its own bootstrap registers
// the provider from agent/settings.json; moving the owner to the session host is then refused with the structured
// PROVIDER_POLICY envelope and nothing moves.
// PI_TEST_PLAYWRIGHT=... PI_TEST_CHROMIUM=... node tests/web/check-plugin-provider-ui.mjs
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { writePluginDirectory } from "./remote-extension-ui/write-plugin-directory.mjs";
import { settingsNavigation } from "./remote-extension-ui/settings-navigation.mjs";
import { checkProviderRestart } from "./plugin-provider-ui/check-provider-restart.mjs";

for (const key of ["PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) {
  if (!process.env[key]) throw new Error(`${key} is required; see docs/kernel-recovery.md.`);
}
const PROVIDER_ID = "plugin-ui-owner";
// Never contacted: the check reads registration and ownership only.
const modelConfig = (id) => ({ baseUrl: "http://127.0.0.1:1/v1", apiKey: "fixture-only", api: "openai-responses", models: [{ id, name: id, input: ["text"], reasoning: false, contextWindow: 4096, maxTokens: 128, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] });
const root = await mkdtemp(join(tmpdir(), "prk-plugin-owner-"));
const evidence = process.env.PI_TEST_WEB_EVIDENCE ? resolve(process.env.PI_TEST_WEB_EVIDENCE) : await mkdtemp(join(tmpdir(), "prk-plugin-owner-evidence-"));
const previousHome = process.env.HOME;
const previousPrkHome = process.env.PRK_HOME;
process.env.HOME = join(root, "user");
const home = join(root, "home");
// Any implicit home lookup lands in the owned home too, never ~/.config/pi-remote-kernel.
process.env.PRK_HOME = home;
const socket = join(home, "g.sock");
const document = { monitor: { enabled: false }, memory: { review: false }, session: { noExtensions: false, idleTimeoutMs: 60000 } };
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(read, check, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read().catch(() => undefined);
    if (value !== undefined && check(value)) return value;
    if (Date.now() >= deadline) throw new Error(`Timed out: ${label}`);
    await delay(50);
  }
}
let gateway, web, ui, browser;
try {
  await mkdir(process.env.HOME, { recursive: true });
  await mkdir(evidence, { recursive: true });
  const { agentDir } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, "models.json"), JSON.stringify({ providers: { "plugin-ui-manual": modelConfig("manual") } }));
  await writeFile(join(agentDir, "settings.json"), "{}\n", { mode: 0o600 });
  const owner = await writePluginDirectory(join(root, "provider-owner"), { name: "@prk-tests/plugin-ui-owner", source: `export default (pi) => { pi.registerProvider(${JSON.stringify(PROVIDER_ID)}, ${JSON.stringify(modelConfig("owned"))}); };\n` });
  // The production bootstrap: no runtimeDependencies, so the Gateway builds its ModelRuntime and registers package providers itself.
  const boot = async () => startGateway(await createGatewayHost({ cwd: home, home, config: parsePrkConfig(document), model: "plugin-ui-manual/manual", thinkingLevel: "off" }), socket);
  gateway = await boot();
  web = await startWebApplication({ socket, home, host: "127.0.0.1", port: 0 });
  ui = await startWebDev(web.server.url);
  const api = async (path) => {
    const response = await fetch(`${web.server.url}/api${path}`);
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  };
  const entry = async () => (await api("/plugins")).packages.find((pkg) => pkg.source === owner);
  const models = async () => (await api("/models")).models.map(({ value }) => value);

  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // No systemd unit is configured for this owned home: nothing may ever ask for a real Gateway restart.
  const restartRequests = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/gateway/restart") restartRequests.push(request.method()); });
  const { openSettings } = settingsNavigation(page);
  const manager = () => page.locator('#plugins-manager[aria-busy="false"]');
  const row = () => manager().locator(`[data-plugin-source="${owner}"]`);
  const post = async (path, action) => {
    const received = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === path, { timeout: 60000 });
    // A failing action must surface itself, not the waiter's later "page closed" rejection.
    received.catch(() => {});
    await action();
    const response = await received;
    await manager().waitFor();
    return response;
  };
  // The test restarts its own in-process Gateway (real bootstrap again), then reopens the plugin page.
  const restartGateway = async () => {
    await gateway.close();
    gateway = await boot();
    await until(() => api("/plugins"), Boolean, "API reaches the restarted Gateway");
    await page.reload();
    await openSettings("plugins");
    await manager().waitFor();
  };
  await page.goto(ui.url);
  await openSettings("plugins");
  await manager().waitFor();

  // A rejected install (the directory does not exist) shows under the form, keeps the typed source and saves nothing.
  const missing = join(root, "missing-plugin");
  await page.locator("#plugin-source").fill(missing);
  const rejected = await post("/api/plugins/install", () => page.locator("#plugin-install").click());
  assert.equal(rejected.ok(), false);
  await page.locator("#plugin-error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#plugin-source").inputValue(), missing);
  assert.equal((await api("/plugins")).packages.length, 0);

  // The install form defaults to the Gateway; the user picks it, and that choice is what the request carries and saves.
  assert.equal(await page.locator("#plugin-install-location").inputValue(), "gateway");
  await page.locator("#plugin-install-location").selectOption("gateway");
  await page.locator("#plugin-source").fill(owner);
  const installed = await post("/api/plugins/install", () => page.locator("#plugin-install").click());
  assert.equal(installed.status(), 200);
  assert.deepEqual(installed.request().postDataJSON(), { source: owner, location: "gateway" });
  await row().waitFor();
  assert.equal(await row().getAttribute("data-location"), "gateway");
  assert.equal(await page.locator("#plugin-install-location").inputValue(), "gateway", "the form keeps the default location");
  assert.deepEqual(await entry().then(({ enabled, location }) => ({ enabled, location })), { enabled: true, location: "gateway" });
  // P4: the saved owner waits for a restart; the running bootstrap does not hot-register it. The install answer and its
  // notice are asserted at the end, so a wrong install answer still lets the remaining P4 paths produce evidence.
  const atInstall = { restartRequired: (await installed.json()).restartRequired, notice: await page.locator('#plugin-restart-notice[data-status="unconfigured"]').count() };
  assert.equal((await models()).includes(`${PROVIDER_ID}/owned`), false, "models keep the actual bootstrap before restart");

  // Real bootstrap reads the saved list: the provider is registered on the Gateway and owned by this package.
  await restartGateway();
  const registered = await until(entry, (pkg) => pkg?.providerIds.includes(PROVIDER_ID), "provider owner after bootstrap");
  assert.deepEqual(registered.providerIds, [PROVIDER_ID]);
  assert.deepEqual(registered.providerErrors, []);
  assert.ok((await models()).includes(`${PROVIDER_ID}/owned`), "the Gateway location took effect: the provider's model is listed");
  assert.equal((await api("/plugins")).restartRequired, false);
  assert.equal(await page.locator("#plugin-restart-notice").count(), 0);
  assert.equal(await row().getAttribute("data-provider-count"), "1");
  assert.equal(await row().locator(`[data-provider-id="${PROVIDER_ID}"]`).count(), 1);

  // Placing the owner on the session host is refused structurally; the location is not changed for the user.
  const refused = await post("/api/plugins/change", () => row().locator('[data-action="plugin-location"]').selectOption("host"));
  assert.equal(refused.ok(), false);
  assert.deepEqual(refused.request().postDataJSON(), { source: owner, location: "host" });
  const envelope = await refused.json();
  assert.equal(envelope.code, "PROVIDER_POLICY");
  assert.ok(envelope.details.providerErrors.some((item) => item.code === "PROVIDER_POLICY" && item.providerId === PROVIDER_ID));
  await row().locator('[data-kind="plugin-change-error"][data-code="PROVIDER_POLICY"]').waitFor({ state: "visible" });
  assert.ok(await row().locator(`[data-field="provider-error"][data-code="PROVIDER_POLICY"][data-provider-id="${PROVIDER_ID}"]`).count() >= 1);
  assert.equal(await row().getAttribute("data-location"), "gateway");
  assert.equal(await row().locator('[data-action="plugin-location"]').inputValue(), "gateway");
  assert.equal((await entry()).location, "gateway");
  assert.ok((await models()).includes(`${PROVIDER_ID}/owned`));
  await page.screenshot({ path: join(evidence, "plugin-provider-desktop.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-settings-section="plugins"]').click();
  await manager().waitFor();
  // The same refusal on the phone layout (the reopened page starts without the desktop's rejection).
  const phoneRefused = await post("/api/plugins/change", () => row().locator('[data-action="plugin-location"]').selectOption("host"));
  assert.equal(phoneRefused.ok(), false);
  await row().locator('[data-kind="plugin-change-error"][data-code="PROVIDER_POLICY"]').waitFor({ state: "visible" });
  assert.equal(await row().getAttribute("data-location"), "gateway");
  await page.screenshot({ path: join(evidence, "plugin-provider-phone.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-settings-section="plugins"]').click();
  await manager().waitFor();
  await checkProviderRestart({ page, post, api, models, row, manager, openSettings, restartGateway, evidence, owner, providerId: PROVIDER_ID, root });
  assert.deepEqual(restartRequests, [], "the unconfigured restart entry never sends a request");
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(atInstall, { restartRequired: true, notice: 1 }, "P4: installing a provider owner answers restartRequired:true and shows the unconfigured notice");
  console.log(`PASS plugin provider UI: install with chosen Gateway location; real bootstrap ownership; structured host refusal; restartRequired notice for provider install/disable/enable/uninstall (empty list too), models kept until restart, plain CRUD without restart, unconfigured restart entry shared with 通用. Evidence: ${evidence}`);
} finally {
  await browser?.close();
  await ui?.close();
  await web?.close();
  await gateway?.close();
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  if (previousPrkHome === undefined) delete process.env.PRK_HOME;
  else process.env.PRK_HOME = previousPrkHome;
  await rm(root, { recursive: true, force: true });
}
