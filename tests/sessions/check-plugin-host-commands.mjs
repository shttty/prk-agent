import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { ArtifactStore } from "../../src/artifacts/store/assemble-store.ts";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { resolvePluginPackage } from "../../src/plugins/packages/resolve-package.ts";
import { prepareRemoteExtensions } from "../../src/remote-extensions/session-load/prepare.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createHostedExtensionUI } from "../../src/sessions/extension-ui/assemble-extension-ui.ts";
import { HOSTED_THEME_PATHS } from "../../src/sessions/session-settings/theme-paths.ts";
import { createHostFixture } from "../target-environment/host/create-host-fixture.mjs";

const machine = process.argv[2] ?? "local";
assert(process.env.PI_TEST_PLUGIN_AGENT, "PI_TEST_PLUGIN_AGENT must point at an owned copy of the real installed npm packages");
const taste = process.env.PI_TEST_TASTE_PACKAGE;
assert(taste && isAbsolute(taste), "PI_TEST_TASTE_PACKAGE must point at an owned copy of the gpt-with-taste package");
const root = await mkdtemp(join(tmpdir(), "prk-real-plugin-commands-"));
const previousHome = process.env.HOME;
process.env.HOME = root;
const home = join(root, "prk");
const { agentDir } = initializePrkHome(home);
const store = new ArtifactStore(join(home, "assets"));
let fixture;
try {
  await mkdir(agentDir, { recursive: true });
  const { DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, createAgentSession } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider } = await import("@earendil-works/pi-ai");
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "owned-unused", models: [{ id: "unused" }] });
  runtime.registerNativeProvider(provider.provider);
  fixture = await createHostFixture(machine, store);
  const webConfig = JSON.stringify({ toolActivation: "eager", searxngBaseUrl: "http://127.0.0.1:1", webSearch: { allowedProviders: ["searxng"] }, ssrf: { allowRanges: ["127.0.0.1/32"] } });
  await fixture.fixture.observe(`mkdir -p '${fixture.fixture.root}/.pi/agent'; printf '%s' '${webConfig}' > '${fixture.fixture.root}/.pi/agent/web-search.json'`);
  const config = parsePrkConfig({ monitor: { enabled: false } });
  const plugins = [
    { source: join(process.env.PI_TEST_PLUGIN_AGENT, "npm/node_modules/@sting8k/pi-vcc"), command: "/pi-vcc-recall", message: "No session file available" },
    { source: taste, command: "/taste status", message: "taste" },
    { source: join(process.env.PI_TEST_PLUGIN_AGENT, "npm/node_modules/pi-web-access"), command: "/search", message: "search" },
  ];
  const selected = process.argv[3] === "unsupported" ? plugins.filter((plugin) => plugin.command !== "/taste status") : process.argv[3] ? plugins.filter((plugin) => plugin.command === process.argv[3]) : plugins;
  assert(selected.length, "Unknown command selector");
  for (const plugin of selected) {
    const statuses = [];
    let generation;
    const load = await prepareRemoteExtensions({
      target: { id: "owned", label: "Owned real plugins", local: machine === "local", tags: [], kernel: { cwd: fixture.fixture.root } },
      channels: fixture.channels, store, storeDir: store.directory, nativeTools: false,
      packages: [...new Set([plugin.source, taste])].map((source) => resolvePluginPackage({ source, enabled: true, location: "host" }, home, agentDir)),
      projectTrusted: () => false, hostOptions: { ...config.remoteHost, runtime: "node" },
      onStatus(value) { statuses.push(value); }, onRemoteExtensionGeneration(value) { generation = value; },
      env: { PI_CODING_AGENT_DIR: `${fixture.fixture.root}/.pi/agent`, XDG_CACHE_HOME: `${fixture.fixture.root}/.cache`, PI_HINDSIGHT_ENABLED: "0" },
    });
    let session;
    let ui;
    try {
      const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
      const loader = new DefaultResourceLoader({ cwd: home, agentDir, settingsManager, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, additionalThemePaths: HOSTED_THEME_PATHS, extensionFactories: load.factories });
      await loader.reload();
      assert.deepEqual(loader.getExtensions().errors, []);
      const rejected = statuses.at(-1)?.find(({ name }) => name === plugin.source && name !== taste);
      if (rejected) {
        assert.equal(rejected.errorCode, "UNSUPPORTED", JSON.stringify(rejected));
        assert.equal(rejected.errorDetails?.member, plugin.command === "/pi-vcc-recall" ? "tool.prepareArguments" : "pi.registerShortcut", JSON.stringify(rejected));
      } else assert(!statuses.at(-1)?.some(({ error }) => error), JSON.stringify(statuses.at(-1)));
      assert(generation?.registration, JSON.stringify(statuses.at(-1)));
      assert.notEqual(generation.registration.pid, process.pid);
      const command = rejected ? "/taste status" : plugin.command;
      assert(generation.registration.commands.some(({ name }) => name === command.slice(1).split(" ")[0]));
      assert(generation.registration.packages.some((pkg) => pkg.name === taste && !pkg.error));
      ({ session } = await createAgentSession({ cwd: home, agentDir, modelRuntime: runtime, model: provider.getModel(), resourceLoader: loader, settingsManager, sessionManager: SessionManager.inMemory(home), tools: [] }));
      ui = await createHostedExtensionUI(session, agentDir);
      await session.bindExtensions({ uiContext: ui.context });
      await session.prompt(command);
      const view = ui.snapshot();
      assert(JSON.stringify(view).toLowerCase().includes(rejected ? "role: main" : plugin.message.toLowerCase()), JSON.stringify(view));
      assert.equal(session.messages.filter(({ role }) => role === "assistant").length, 0, "Commands must not make model requests");
      console.log(JSON.stringify({ machine, command, rejected, hostWebConfig: JSON.parse(webConfig), proof: rejected ? "real rejected package and healthy original taste handler share the same host generation" : "original host command", pid: generation.registration.pid, package: plugin.source, registration: generation.registration, ui: view }));
    } finally { ui?.dispose(); await session?.dispose(); await load.close(); }
  }
} finally {
  await fixture?.close();
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
