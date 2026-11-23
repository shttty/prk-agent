import { parse, stringify } from "smol-toml";
// One focused scenario through the real SDK/Gateway/HTTP/UI; faux provider, isolated home, no paid calls.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parseTargets } from "./target-instances/parse-targets.mjs";
import { listKernelProcesses } from "./target-instances/list-kernel-processes.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { checkSessionSettings } from "../fixtures/capability-ui/check-session-settings.mjs";
import { checkSkillCatalog } from "../fixtures/capability-ui/check-skill-catalog.mjs";
import { checkInstanceSettings } from "../fixtures/capability-ui/check-instance-settings.mjs";
import { checkInstanceAvailability } from "../fixtures/capability-ui/check-instance-availability.mjs";
import { checkCopyPeekBoundary } from "../fixtures/capability-ui/check-copy-peek-boundary.mjs";

const home = await mkdtemp(join(tmpdir(), "prk-capability-ui-"));
const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
try {
  const { agentDir } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { startWebApplication } = await import("../../src/http/application/start-application.ts");
  const { startWebDev } = await import("../fixtures/web-dev.mjs");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { SkillLibrary } = await import("../../src/sessions/skill-library/assemble-skill-library.ts");
  await mkdir(join(home, "kernel-tools"));
  await writeFile(join(home, "kernel-tools/panel_module.py"), "from prk_tool import tool\n@tool\ndef panel_module_probe():\n    \"\"\"Module UI fixture.\"\"\"\n    return 7013\n");
  await writeFile(join(home, "kernel-tools/panel_broken.py"), "import prk_missing_ui_dependency_7013\n");
  const plugin = join(home, "fixture-plugin");
  await mkdir(plugin);
  await writeFile(join(plugin, "package.json"), JSON.stringify({ name: "prk-panel-fixture", pi: { extensions: ["index.ts"] } }));
  const dynamicInventory = join(plugin, "catalog.json");
  await writeFile(dynamicInventory, JSON.stringify(["panel_late"]));
  await writeFile(join(plugin, "index.ts"), `import { readFile } from "node:fs/promises";
export default function(pi) {
  const register = (name) => pi.registerTool({name,label:name,description:"Inspect the isolated capability fixture.\\nReports a deterministic fixture result without external requests.",parameters:{type:"object",properties:{}},execute:async()=>({content:[{type:"text",text:"fixture"}],details:{}})});
  for (const name of ["panel_probe", "panel_other"]) register(name);
  pi.on("session_start", async () => { for (const name of JSON.parse(await readFile(${JSON.stringify(dynamicInventory)}, "utf8"))) register(name); });
}`);
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [plugin] }));
  const document = { session: { noExtensions: false, idleTimeoutMs: 60000 }, memory: { review: false } };
  await writeFile(join(home, "config.toml"), stringify(document));
  const skills = new SkillLibrary(home);
  skills.manage({ action: "create", name: "panel-skill", scope: "global", description: "Reusable fixture workflow", whenToUse: "Checking shared skill management.", evidence: "Observed isolated panel workflow.", procedure: ["Read the fixture."], pitfalls: [], verification: [] });
  // Plugin config: the fixture package has semantics (as plugin_config.set would store them); its file has a field the
  // form does not describe, which a write must keep.
  const { PluginConfigStore } = await import("../../src/sessions/plugin-config/assemble-plugin-config.ts");
  const pluginFile = join(home, "fixture-plugin-config.json");
  await writeFile(pluginFile, JSON.stringify({ limit: 3, token: "tok_plain", extra: { keep: true } }));
  new PluginConfigStore(home).set("prk-panel-fixture", pluginFile, [{ title: "Fixture", fields: [{ key: "limit", label: "Limit", type: "number" }, { key: "token", label: "Token", type: "string" }] }]);
  const rawFile = join(home, "kernel-config.json");
  await writeFile(rawFile, JSON.stringify({ depth: 2, nested: { on: false } }));
  await withTargetFixture(async ({ config, onCleanup }) => {
    // Live REPL processes working under this home (the fixture's own scratch directory is never a session cwd here).
    const kernels = () => listKernelProcesses(config.python, home);
    const initialKernels = await kernels();
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "panel-ui", models: [{ id: "controlled" }] });
    modelRuntime.registerNativeProvider(provider.provider);
    const host = await createGatewayHost({ cwd: home, home, model: "panel-ui/controlled", config: parsePrkConfig(document), targets: parseTargets([
      { id: "fixture", label: "Fixture", tags: [], ...config, cwd: home },
    ]) }, { runtimeDependencies: { cwd: home, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off" } });
    const gateway = await startGateway(host, join(home, "gateway.sock"));
    onCleanup(() => gateway.close());
    const web = await startWebApplication({ socket: join(home, "gateway.sock"), host: "127.0.0.1", port: 0 });
    onCleanup(() => web.close());
    const ui = await startWebDev(web.server.url);
    onCleanup(() => ui.close());
    const browser = await loadChromium();
    onCleanup(() => browser.close());
    const emptyContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const emptyPage = await emptyContext.newPage();
    const emptyErrors = [];
    emptyPage.on("pageerror", (error) => emptyErrors.push(error.message));
    emptyPage.setDefaultTimeout(15000);
    await emptyPage.goto(ui.url);
    // Provider list on the left; the right block shows the chosen provider (the live crossfade layer).
    const live = '.capability-detail-host > .pi-fade-live';
    // A page/provider switch keeps a fading copy of the old layer for 120 ms; let it go before locating hooks.
    const settled = (page) => page.waitForFunction(() => !document.querySelector(".pi-fade-leaving"));
    const showProvider = async (page, provider, scope = live) => {
      await page.locator(`#tools-sources [data-provider="${provider}"] .capability-provider-name, #skills-sources [data-provider="${provider}"] .capability-provider-name`).click();
      await settled(page);
      // Phone: the provider sheet slides in (transform); act on it once it rests.
      if (scope === "#capability-sheet") await page.waitForFunction(() => getComputedStyle(document.querySelector("#capability-sheet")).transform === "none");
      await page.locator(`${scope} [data-capability-group="${provider}"]`).waitFor();
    };
    await emptyPage.locator("#open-settings").click();
    await emptyPage.locator('[data-settings-section="tools"]').click();
    await emptyPage.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor(); await settled(emptyPage);
    await showProvider(emptyPage, "group:tools:package:prk-panel-fixture");
    for (const id of ["tool:panel_probe", "tool:panel_late"]) await emptyPage.locator(`${live} [data-capability="${id}"]`).waitFor();
    await checkCopyPeekBoundary({ page: emptyPage, row: emptyPage.locator(`${live} [data-capability="tool:panel_probe"]`) });
    for (const id of ["kernel:module:files", "kernel:module:panel_module"]) {
      const pendingRow = emptyPage.locator(`${live} [data-capability="${id}"][data-pending="true"]`);
      await pendingRow.scrollIntoViewIfNeeded();
      await pendingRow.waitFor();
    }
    await emptyPage.locator('[data-settings-section="skills"]').click();
    await emptyPage.locator('.capabilities-panel[data-kind="skills"][aria-busy="false"]').waitFor(); await settled(emptyPage);
    await showProvider(emptyPage, "group:skills:shared");
    await emptyPage.locator(`${live} [data-capability^="skill:"] [data-name="panel-skill"]`).waitFor();
    await checkCopyPeekBoundary({ page: emptyPage, row: emptyPage.locator(`${live} #skills-entry-panel-skill`) });
    await emptyPage.locator('[data-action="refresh-capabilities"]').waitFor();
    assert.deepEqual(host.workbench().sessions, [], "directory startup creates no managed session");
    assert.deepEqual(await kernels(), initialKernels, "directory startup allocates no kernel");

    await emptyPage.locator('[data-settings-section="tools"]').click();
    await emptyPage.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor(); await settled(emptyPage);
    await showProvider(emptyPage, "group:tools:package:prk-panel-fixture");
    await writeFile(dynamicInventory, JSON.stringify(["panel_refreshed"]));
    // Hold the real backend response only to observe the in-flight button deterministically.
    let releaseRefresh;
    const responseGate = new Promise((resolve) => { releaseRefresh = resolve; });
    await emptyPage.route("**/api/capabilities/refresh", async (route) => {
      const response = await route.fetch();
      await responseGate;
      await route.fulfill({ response });
    });
    try {
      await emptyPage.locator('[data-action="refresh-capabilities"]').click();
      await emptyPage.locator('[data-action="refresh-capabilities"][aria-busy="true"][data-loading]').waitFor();
    } finally { releaseRefresh(); }
    await emptyPage.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor();
    await emptyPage.locator(`${live} [data-capability="tool:panel_refreshed"]`).waitFor();
    assert.equal(await emptyPage.locator(`${live} [data-capability="tool:panel_late"]`).count(), 0, "full refresh removes absent dynamic registrations");
    await emptyPage.unroute("**/api/capabilities/refresh");
    await writeFile(dynamicInventory, "{");
    await emptyPage.locator('[data-action="refresh-capabilities"]').click();
    await emptyPage.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor();
    await emptyPage.locator("#capabilities-error").waitFor();
    await emptyPage.locator(`${live} [data-capability="tool:panel_refreshed"]`).waitFor();
    await writeFile(dynamicInventory, JSON.stringify(["panel_refreshed"]));
    await emptyPage.locator('[data-action="refresh-capabilities"]').click();
    await emptyPage.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor();
    assert.equal(await emptyPage.locator("#capabilities-error").count(), 0, "a successful retry clears the refresh error");
    assert.deepEqual(host.workbench().sessions, [], "manual directory refresh creates no managed session");
    assert.deepEqual(await kernels(), initialKernels, "manual directory refresh allocates no kernel");
    assert.deepEqual((await readdir(home, { recursive: true })).filter((path) => path.endsWith(".jsonl")), [], "directory sessions never write JSONL");
    const moduleWorker = (await host.createSession({ target: "fixture" })).session.sessionId;
    provider.setResponses([fauxAssistantMessage(fauxToolCall("kernel_code", { code: "assert panel_module_probe() == 7013" }), { stopReason: "toolUse" }), fauxAssistantMessage("Observed module fixture.")]);
    const moduleOperation = await host.session(moduleWorker).submit({ requestId: crypto.randomUUID(), message: "Exercise module catalog." });
    assert.equal(moduleOperation.accepted, true);
    assert.equal((await moduleOperation.completion).status, "completed");
    const moduleResult = host.state(moduleWorker).messages.findLast((message) => message.role === "toolResult");
    assert.equal(moduleResult.isError, false, JSON.stringify(moduleResult));
    await emptyPage.locator('[data-action="refresh-capabilities"]').click();
    await emptyPage.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor();
    await showProvider(emptyPage, "group:tools:kernel");
    const moduleRow = emptyPage.locator(`${live} [data-capability="kernel:panel_module_probe"][data-module="panel_module"][data-available="true"]`);
    await moduleRow.waitFor();
    assert.equal(await emptyPage.locator(`${live} [data-capability="kernel:module:panel_module"]`).count(), 0);
    for (const name of ["read", "edit", "write", "grep"]) {
      await emptyPage.locator(`${live} [data-capability="kernel:${name}"][data-module="files"][data-available="true"]`).waitFor();
    }
    assert.equal(await emptyPage.locator(`${live} [data-capability="kernel:module:files"]`).count(), 0);
    const brokenRow = emptyPage.locator(`${live} [data-capability="kernel:module:panel_broken"][data-available="false"]`);
    await brokenRow.scrollIntoViewIfNeeded();
    assert.equal(await brokenRow.locator('[data-stop="off"]').isDisabled(), true);
    await brokenRow.locator('.capability-name').hover();
    await emptyPage.locator('#capability-peek[data-open="true"] [data-field="module-error"]').waitFor();
    await emptyPage.mouse.move(1, 1);
    await moduleRow.locator('[data-stop="off"]').click();
    await emptyPage.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor();
    assert.equal(structuredClone(parse(await readFile(join(home, "config.toml"), "utf8"))).session.capabilities["kernel:panel_module_probe"], false);
    await host.closeSession(moduleWorker);
    assert.deepEqual(await kernels(), initialKernels, "Module UI discovery closes only its owned test kernel");
    assert.deepEqual(emptyErrors, [], "zero-session global pages: zero pageerror");
    await emptyContext.close();
    console.log("PASS global catalog without sessions: static/dynamic tools, kernel helper, skill, refresh spinner/full replacement, no kernel or JSONL; pageerrors=0");
    await checkSessionSettings({ browser, ui, host, provider, home, pluginFile, rawFile, evidence, live, settled, showProvider });
    await checkSkillCatalog({ browser, ui, evidence, live, settled, showProvider });
    await checkInstanceSettings({ browser, ui, evidence, settled });
    await checkInstanceAvailability({ browser, ui });
  });
} finally { await rm(home, { recursive: true, force: true }); }
