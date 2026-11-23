// P5 on a really bootstrapped Gateway with an owned local session host: a plugin whose tool has a synchronous
// `prepareArguments` cannot run in the session host. The page must show the real structured rejection (code UNSUPPORTED,
// details.member tool.prepareArguments) for a host install and a move to host, the listed package's
// error/errorCode/errorDetails when its linked directory later gains the member, and a failed list load with its code.
// Nothing moves automatically. Screenshots and raw envelopes go to PI_TEST_WEB_EVIDENCE.
// SHELL=/bin/bash PI_TEST_PYTHON=... PI_TEST_PLAYWRIGHT=... PI_TEST_CHROMIUM=... node tests/web/check-plugin-unsupported-ui.mjs
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { stringify } from "smol-toml";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { writePluginDirectory } from "./remote-extension-ui/write-plugin-directory.mjs";
import { settingsNavigation } from "./remote-extension-ui/settings-navigation.mjs";
import { checkUnsupportedFailures } from "./plugin-unsupported-ui/check-unsupported-failures.mjs";

for (const key of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) {
  if (!process.env[key]) throw new Error(`${key} is required; see docs/kernel-recovery.md.`);
}
// Never contacted: no prompt is sent.
const modelConfig = (id) => ({ baseUrl: "http://127.0.0.1:1/v1", apiKey: "fixture-only", api: "openai-responses", models: [{ id, name: id, input: ["text"], reasoning: false, contextWindow: 4096, maxTokens: 128, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] });
// The same public tool with and without the synchronous member the session host cannot proxy.
const toolSource = (withPrepare) => `export default (pi) => { pi.registerTool({ name: "prep_probe", label: "Prep probe", description: "Fixture tool",
  parameters: { type: "object", properties: {}, additionalProperties: false },${withPrepare ? "\n  prepareArguments(args) { return args; }," : ""}
  async execute() { return { content: [{ type: "text", text: "PREP_PROBE" }] }; } }); };\n`;
const root = await mkdtemp(join(tmpdir(), "prk-plugin-unsupported-"));
const evidence = process.env.PI_TEST_WEB_EVIDENCE ? resolve(process.env.PI_TEST_WEB_EVIDENCE) : await mkdtemp(join(tmpdir(), "prk-plugin-unsupported-evidence-"));
const previous = { HOME: process.env.HOME, PRK_HOME: process.env.PRK_HOME };
process.env.HOME = join(root, "user");
const home = join(root, "home");
process.env.PRK_HOME = home;
const socket = join(home, "g.sock");
try {
  await mkdir(process.env.HOME, { recursive: true });
  await mkdir(evidence, { recursive: true });
  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
    const { agentDir } = initializePrkHome(home);
    await mkdir(agentDir, { recursive: true });
    await prepareNativeToolArtifacts(home);
    await writeFile(join(agentDir, "models.json"), JSON.stringify({ providers: { "unsupported-manual": modelConfig("manual") } }));
    await writeFile(join(agentDir, "settings.json"), "{}\n", { mode: 0o600 });
    const document = { monitor: { enabled: false }, memory: { review: false }, session: { noExtensions: false, noSkills: true, bootstrapNoSkills: true, idleTimeoutMs: 600000 } };
    const instances = { instances: [{ id: "fixture", label: "Unsupported fixture", tags: [], ...config, local: true, cwd: tempRoot }] };
    await writeFile(join(home, "config.toml"), stringify(document));
    await writeFile(join(home, "instances.toml"), stringify(instances), { mode: 0o600 });
    const prepared = await writePluginDirectory(join(root, "prepare-probe"), { name: "@prk-tests/prepare-probe", source: toolSource(true) });
    const later = await writePluginDirectory(join(root, "later-probe"), { name: "@prk-tests/later-probe", source: toolSource(false) });
    // The production bootstrap: no runtimeDependencies.
    const boot = async () => startGateway(await createGatewayHost({ cwd: home, home, config: parsePrkConfig(document, instances), model: "unsupported-manual/manual", thinkingLevel: "off" }), socket);
    let gateway = await boot();
    const web = await startWebApplication({ socket, home, host: "127.0.0.1", port: 0 });
    const ui = await startWebDev(web.server.url);
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    const browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    onCleanup(async () => { await browser.close(); await ui.close(); await web.close(); await gateway?.close(); });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(60000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(ui.url);
    const api = async (path) => { const response = await fetch(`${web.server.url}/api${path}`); return { status: response.status, body: await response.json() }; };
    await checkUnsupportedFailures({
      page, api, evidence, prepared, later, ...settingsNavigation(page),
      editLater: () => writePluginDirectory(later, { name: "@prk-tests/later-probe", source: toolSource(true) }),
      stopGateway: async () => { await gateway.close(); gateway = undefined; },
      startGateway: async () => { gateway = await boot(); },
    });
    assert.deepEqual(pageErrors, []);
    console.log(`PASS plugin unsupported UI: structured UNSUPPORTED tool.prepareArguments on host install and move to host, listed errorCode/errorDetails after a linked directory edit, list load failure code; no automatic move. Evidence: ${evidence}`);
  }, { tempParent: root });
} finally {
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await rm(root, { recursive: true, force: true });
}
