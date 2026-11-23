import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { createSessionSettings } from "../../src/sessions/session-settings/create-settings.ts";
import { HOSTED_THEME_PATHS } from "../../src/sessions/session-settings/theme-paths.ts";
import { createHostedExtensionUI } from "../../src/sessions/extension-ui/assemble-extension-ui.ts";

assert(process.env.PI_TEST_PLUGIN_AGENT, "Use the dedicated copied real agent directory");
const hindsightSource = process.env.PI_TEST_HINDSIGHT_SOURCE;
assert(hindsightSource, "PI_TEST_HINDSIGHT_SOURCE must match the memory plugin source in the owned settings.json");
const root = await mkdtemp(join(tmpdir(), "prk-eight-plugins-"));
const saved = Object.fromEntries(["HOME", "MEMORIES_DIR", "MEMORIES_AGENT", "PI_HINDSIGHT_ENABLED"].map((key) => [key, process.env[key]]));
process.env.HOME = root;
process.env.MEMORIES_DIR = join(root, "memories");
process.env.MEMORIES_AGENT = "owned";
delete process.env.PI_HINDSIGHT_ENABLED;
const home = join(root, "prk");
const { agentDir } = initializePrkHome(home);
let session;
let ui;
try {
  await mkdir(agentDir, { recursive: true });
  await mkdir(process.env.MEMORIES_DIR);
  for (const name of ["settings.json", "models.json", "auth.json", "extensions", "web-search.json", "npm"]) await cp(join(process.env.PI_TEST_PLUGIN_AGENT, name), join(agentDir, name), { recursive: true });
  await writeFile(join(process.env.MEMORIES_DIR, "hindsight.toml"), 'baseUrl = "http://127.0.0.1:1"\nbank = "prk-owned-acceptance"\n[retain]\nenabled = true\n[recall]\nenabled = true\n');
  const configured = JSON.parse(await readFile(join(agentDir, "settings.json"), "utf8")).packages;
  assert.equal(configured.length, 8);
  assert(configured.every((pkg) => pkg.enabled && pkg.location === "gateway"));
  const { createAgentSessionServices, createAgentSessionFromServices, SessionManager } = await import("@earendil-works/pi-coding-agent");
  const services = await createAgentSessionServices({ cwd: home, agentDir, settingsManager: createSessionSettings(home, agentDir), resourceLoaderOptions: { noContextFiles: true, noSkills: true, additionalThemePaths: HOSTED_THEME_PATHS } });
  const loaded = services.resourceLoader.getExtensions();
  assert.deepEqual(loaded.errors, []);
  ({ session } = await createAgentSessionFromServices({ services, sessionManager: SessionManager.inMemory(home) }));
  ui = await createHostedExtensionUI(session, agentDir);
  await session.bindExtensions({ uiContext: ui.context });
  const catalog = configured.map(({ source }) => {
    const extensions = loaded.extensions.filter((extension) => extension.sourceInfo.source === source);
    assert(extensions.length, `Missing actual native registration: ${source}`);
    return { source, paths: extensions.map(({ path }) => path), tools: extensions.flatMap((extension) => [...extension.tools.keys()]), commands: extensions.flatMap((extension) => [...extension.commands.keys()]), hooks: extensions.flatMap((extension) => [...extension.handlers.keys()]) };
  });
  const hindsight = catalog.find(({ source }) => source === hindsightSource);
  assert(hindsight, "Missing configured Hindsight plugin");
  assert(hindsight.tools.length > 0);
  assert(hindsight.hooks.includes("before_agent_start"));
  assert(hindsight.hooks.includes("message_end"));
  assert(hindsight.hooks.includes("agent_end"));
  for (const command of ["/pi-vcc-recall", "/taste status", "/search"]) await session.prompt(command);
  assert.equal(session.messages.filter(({ role }) => role === "assistant").length, 0, "No model requests during directory/command acceptance");
  console.log(JSON.stringify({ scope: "fresh native Pi session using PRK settings projection; all eight real packages; Hindsight original registration enabled at explicit offline endpoint 127.0.0.1:1; no memory-service effects or model requests claimed", catalog, commands: ["/pi-vcc-recall", "/taste status", "/search"], ui: ui.snapshot() }, null, 2));
} finally {
  if (session) await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
  ui?.dispose(); await session?.dispose();
  for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await rm(root, { recursive: true, force: true });
}
