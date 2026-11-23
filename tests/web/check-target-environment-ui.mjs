// P6 remote environment deploy on the real path (docs/wire/targets.md, 实例环境下发): a really bootstrapped Gateway, its
// HTTP API, an owned target daemon reached through a connection command, a cold target cache and two real browser pages.
// Covers adding a machine (save deploys, the editor shows real progress), new sessions waiting on the instance's one
// shared task before the original synchronous create, a lost browser link that never creates by itself, and a Gateway
// restart mid-transfer that fails with an explicit retry. No model is called.
// SHELL=/bin/bash PI_TEST_PYTHON=... PI_TEST_PLAYWRIGHT=... PI_TEST_CHROMIUM=... [PI_TEST_WEB_EVIDENCE=dir]
//   node tests/web/check-target-environment-ui.mjs
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse, stringify } from "smol-toml";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { settingsNavigation } from "./remote-extension-ui/settings-navigation.mjs";
import { recordPage } from "./target-environment-ui/record-frames.mjs";
import { checkAddMachine } from "./target-environment-ui/check-add-machine.mjs";
import { checkCreateFlows } from "./target-environment-ui/check-create-flows.mjs";

for (const key of ["PI_TEST_PYTHON", "PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) {
  if (!process.env[key]) throw new Error(`${key} is required; see docs/kernel-recovery.md.`);
}
const modelConfig = (id) => ({ baseUrl: "http://127.0.0.1:1/v1", apiKey: "fixture-only", api: "openai-responses", models: [{ id, name: id, input: ["text"], reasoning: false, contextWindow: 4096, maxTokens: 128, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] });
const root = await mkdtemp(join(tmpdir(), "prk-target-env-"));
const evidence = process.env.PI_TEST_WEB_EVIDENCE ? resolve(process.env.PI_TEST_WEB_EVIDENCE) : await mkdtemp(join(tmpdir(), "prk-target-env-evidence-"));
const previous = { HOME: process.env.HOME, PRK_HOME: process.env.PRK_HOME };
process.env.HOME = join(root, "user");
const home = join(root, "home");
process.env.PRK_HOME = home;
const socket = join(home, "g.sock");
// The target gets an owned cache root, separate from both real and fixture HOME defaults.
const targetHome = join(root, "target-home");
const targetCaches = [join(targetHome, "target-cache")];
try {
  await mkdir(process.env.HOME, { recursive: true });
  await mkdir(targetHome, { recursive: true });
  await mkdir(evidence, { recursive: true });
  await withTargetFixture(async ({ tempRoot, onCleanup }) => {
    const { agentDir } = initializePrkHome(home);
    await mkdir(agentDir, { recursive: true });
    await prepareNativeToolArtifacts(home);
    await writeFile(join(agentDir, "models.json"), JSON.stringify({ providers: { "env-manual": modelConfig("manual") } }));
    await writeFile(join(agentDir, "settings.json"), "{}\n", { mode: 0o600 });
    // Small artifact chunks (a real setting) keep the transfer observable on a local connection: at 64 KiB the ~68 MB
    // compressed environment crossed in about a second, too short to interrupt it or to see both pages on it.
    const document = { targetCacheRoot: targetCaches[0], monitor: { enabled: false }, memory: { review: false }, codemode: { binChunkBytes: 4096 }, session: { noExtensions: false, noSkills: true, bootstrapNoSkills: true, idleTimeoutMs: 600000 } };
    await writeFile(join(home, "config.toml"), stringify(document));
    await writeFile(join(home, "instances.toml"), stringify({ instances: [] }), { mode: 0o600 });
    // A restarted Gateway reads the instances the page saved, as a real restart does.
    const boot = async () => {
      const instances = parse(await readFile(join(home, "instances.toml"), "utf8"));
      return startGateway(await createGatewayHost({ cwd: home, home, config: parsePrkConfig(document, instances), model: "env-manual/manual", thinkingLevel: "off" }), socket);
    };
    let gateway = await boot();
    let web = await startWebApplication({ socket, home, host: "127.0.0.1", port: 0 });
    const port = Number(new URL(web.server.url).port);
    const ui = await startWebDev(web.server.url);
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    const browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    onCleanup(async () => { await browser.close(); await ui.close(); await web?.close(); await gateway?.close(); });
    const api = async (path) => {
      const response = await fetch(`http://127.0.0.1:${port}/api${path}`);
      assert.equal(response.ok, true, `${path}: HTTP ${response.status}`);
      return response.json();
    };
    const pageErrors = [];
    const side = async (viewport) => {
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(60000);
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const recorder = await recordPage(page);
      await page.goto(ui.url);
      return { page, recorder };
    };
    const a = await side({ width: 1440, height: 1000 });
    const b = await side({ width: 390, height: 844 });
    const { name } = await checkAddMachine({ page: a.page, recorder: a.recorder, evidence, api, label: "Environment fixture", ...settingsNavigation(a.page),
      connection: { sshCommand: `HOME=${targetHome} exec /bin/sh`, python: process.env.PI_TEST_PYTHON, cwd: tempRoot } });
    // Instance additions have no collection event (the saving page gets the workbench answer); the other page loads it.
    await b.page.reload();
    await b.page.locator("#open-sidebar").waitFor();
    const flows = checkCreateFlows({
      a, b, evidence, name, api,
      coldCache: async () => { for (const directory of targetCaches) await rm(directory, { recursive: true, force: true }); },
      sessionCount: async () => (await api("/workbench")).sessions.filter((session) => session.target === name).length,
      restartWeb: async () => { await web.close(); web = await startWebApplication({ socket, home, host: "127.0.0.1", port }); },
      restartGateway: async () => { await gateway.close(); gateway = await boot(); },
    });
    // Every rendered panel state of both pages, kept as raw evidence whatever the outcome.
    await flows.finally(async () => writeFile(join(evidence, "rendered-frames.json"), JSON.stringify({ a: await a.recorder.frames(), b: await b.recorder.frames(), posts: { a: a.recorder.posts, b: b.recorder.posts } }, null, 2)));
    assert.deepEqual(pageErrors, []);
    console.log(`PASS target environment UI: add machine deploys with real progress; new sessions share the instance's one task and create once after ready; lost link and Gateway restart fail with explicit retry and never create by themselves. Evidence: ${evidence}`);
  }, { tempParent: root });
} finally {
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await rm(root, { recursive: true, force: true });
}
