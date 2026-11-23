import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { parse, stringify } from "smol-toml";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

const home = await mkdtemp(join(tmpdir(), "prk-capabilities-"));
const previousHome = process.env.HOME;
process.env.HOME = join(home, "user-home");
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools, getCurrentSystemMessage, getSystemMessageText } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const text = (message) => message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
try {
  await mkdir(join(home, "kernel-tools"));
  await writeFile(join(home, "kernel-tools/switch_module.py"), "from prk_tool import tool\n@tool\ndef module_switch_probe():\n    \"\"\"MODULE_SWITCH_DESCRIPTION_9031\"\"\"\n    return 9031\n");
  const plugin = join(home, "fixture-plugin");
  await mkdir(plugin);
  await writeFile(join(plugin, "package.json"), JSON.stringify({ name: "prk-switch-fixture", pi: { extensions: ["index.ts"] } }));
  await writeFile(join(plugin, "index.ts"), `import { createCodemodeExtension } from ${JSON.stringify(new URL("../../node_modules/@earendil-works/pi-coding-agent/dist/index.js", import.meta.url).pathname)}; export default async function(pi) { await createCodemodeExtension()(pi); pi.registerTool({name:"switch_probe",label:"Switch probe",description:"PLUGIN_DESCRIPTION_SWITCH_9031",exposure:"codemode",parameters:{type:"object",properties:{}},execute:async()=>({content:[{type:"text",text:"PLUGIN_EXECUTED_9031"}],details:{}})}); }`);
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source: plugin, enabled: true, location: "gateway" }] }));
  const skillPath = join(agentDir, "skills/manual-probe/SKILL.md");
  await mkdir(join(agentDir, "skills/manual-probe"), { recursive: true });
  await writeFile(skillPath, "---\nname: manual-probe\ndescription: MANUAL_SKILL_DESCRIPTION_9031\n---\nMANUAL_SKILL_BODY_9031\n");
  const gatewayCwd = join(home, "gateway-project");
  const projectSkillPath = join(gatewayCwd, ".agents/skills/project-probe/SKILL.md");
  const userSkillPath = join(process.env.HOME, ".agents/skills/user-probe/SKILL.md");
  for (const [path, name] of [[projectSkillPath, "project-probe"], [userSkillPath, "user-probe"]]) {
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, `---\nname: ${name}\ndescription: Isolated scope fixture\n---\nScope fixture.\n`);
  }
  const startupSkillPath = join(gatewayCwd, ".prk/skills/startup-probe/SKILL.md");
  await mkdir(join(startupSkillPath, ".."), { recursive: true });
  await writeFile(startupSkillPath, "---\nname: startup-probe\ndescription: Startup repository skill must stay project-local\n---\nSTARTUP_PROJECT_SKILL_BODY\n");
  await mkdir(join(gatewayCwd, ".prk/extensions"), { recursive: true });
  await writeFile(join(gatewayCwd, ".prk/extensions/startup-probe.ts"), `export default function(pi) { pi.registerTool({name:"startup_project_probe",label:"Startup project probe",description:"Startup project only",parameters:{type:"object",properties:{}},execute:async()=>({content:[{type:"text",text:"startup project"}],details:{}})}); }`);
  const neutralProjectSkillPath = join(home, ".agents/skills/neutral-project-probe/SKILL.md");
  await mkdir(join(neutralProjectSkillPath, ".."), { recursive: true });
  await writeFile(neutralProjectSkillPath, "---\nname: neutral-project-probe\ndescription: PRK home is not a project\n---\nNEUTRAL_PROJECT_SKILL_BODY\n");
  await withTargetFixture(async ({ config, onCleanup }) => {
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "capability-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const document = { session: { noExtensions: false, idleTimeoutMs: 60000 }, memory: { review: false } };
    await writeFile(join(home, "config.toml"), stringify(document));
    const host = await createGatewayHost({ cwd: gatewayCwd, home, config: parsePrkConfig(document), model: "capability-check/controlled", targets: [
      executionTargetFromConfig({ ...config, id: "fixture", label: "Fixture", local: true, tags: [], cwd: home }),
      executionTargetFromConfig({ ...config, id: "local-project", label: "Local project", local: true, tags: [], cwd: gatewayCwd }),
      executionTargetFromConfig({ ...config, id: "remote-project", label: "Remote project", local: false, tags: [], sshCommand: "/bin/sh", cwd: gatewayCwd }),
    ] }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir } });
    const endpoint = await startGateway(host, join(home, "gateway.sock"));
    onCleanup(() => endpoint.close());
    const client = await connectGateway(join(home, "gateway.sock"));
    onCleanup(() => client.disconnect());
    const globalCatalog = (await client.request("capabilitiesList")).catalog;
    assert.equal(globalCatalog.entries.some((entry) => entry.id === `skill:${projectSkillPath}`), false, "Gateway project skill must not enter the global catalog");
    assert.equal(globalCatalog.entries.find((entry) => entry.id === `skill:${userSkillPath}`)?.group, "group:skills:global");
    const noStartupProject = (catalog) => {
      for (const path of [projectSkillPath, startupSkillPath, neutralProjectSkillPath]) assert(!catalog.entries.some((entry) => entry.id === `skill:${path}`), `Helper catalog leaked project skill ${path}`);
      assert(!catalog.entries.some((entry) => entry.id === "tool:startup_project_probe"), "Helper discovery must not load startup-repository project extensions");
    };
    noStartupProject(globalCatalog);
    noStartupProject((await client.request("capabilitiesRefresh")).catalog);
    for (const instance of ["local-project", "remote-project"]) noStartupProject((await client.request("capabilitiesList", { instance })).catalog);
    const worker = (await client.request("createSession", { target: "fixture" })).session.sessionId;
    const inherited = (await client.request("createSession", { target: "fixture" })).session.sessionId;
    const action = async (name, action, args) => {
      const result = await client.request("nativeAction", { sessionId: name, requestId: crypto.randomUUID(), action, ...(args ? { args } : {}) });
      assert.equal(result.status, "completed", JSON.stringify(result));
      return result.data;
    };
    const toggle = (name, id, enabled) => action(name, "capabilities", { changes: [{ id, enabled }] });
    const catalog = (name = worker) => action(name, "capabilities");
    const item = async (name, id) => (await catalog(name)).entries.find((entry) => entry.id === id);
    const reload = (name = worker) => action(name, "reload");
    const run = async (name, toolName, args, expectError = false) => {
      const requests = [];
      provider.setResponses([
        (context) => {
          requests.push({ tools: getCurrentTools(context.messages).map(({ name }) => name), declarations: getCurrentTools(context.messages), prompt: getSystemMessageText(getCurrentSystemMessage(context.messages)) });
          return fauxAssistantMessage(fauxToolCall(toolName, args), { stopReason: "toolUse" });
        },
        (context) => {
          requests.push({ tools: getCurrentTools(context.messages).map(({ name }) => name), declarations: getCurrentTools(context.messages), prompt: getSystemMessageText(getCurrentSystemMessage(context.messages)) });
          return fauxAssistantMessage("Observed capability operation.");
        },
      ]);
      const admission = await host.session(name).submit({ requestId: crypto.randomUUID(), message: "Exercise the configured capability." });
      assert.equal(admission.accepted, true);
      assert.equal((await admission.completion).status, "completed");
      const result = host.state(name).messages.findLast((message) => message.role === "toolResult");
      assert.equal(result.isError, expectError, text(result));
      return { requests, result };
    };
    const initial = await catalog();
    assert.equal(initial.requiresReload, false, "A different session cwd must not require reloading a Gateway project skill");
    assert.equal(initial.entries.find((entry) => entry.id === "tool:switch_probe").groupLabel, "prk-switch-fixture");
    assert.equal(initial.entries.find((entry) => entry.id === `skill:${skillPath}`).group, "group:skills:home");
    assert.equal(initial.entries.find((entry) => entry.id === "tool:kernel_code").locked, true);
    assert.equal(initial.entries.find((entry) => entry.id === "kernel:module:files")?.pending, true);
    const manual = await run(worker, "kernel_code", { code: `retained_sentinel = 9031\nassert 'MANUAL_SKILL_BODY_9031' in gateway.skill_read(path=${JSON.stringify(skillPath)})` });
    assert(manual.requests[0].prompt.includes("<name>manual-probe</name>"), "Manually installed agent/skills skill is advertised in code mode without local tools");
    const moduleEnabled = await run(worker, "kernel_code", { code: "assert module_switch_probe() == 9031" });
    assert(moduleEnabled.requests[0].prompt.includes("MODULE_SWITCH_DESCRIPTION_9031"));
    assert.equal((await item(worker, "kernel:module_switch_probe")).module, "switch_module");
    const before = host.state(worker);
    const reloadEvents = [];
    client.onEvent((event, source) => { if (source === worker) reloadEvents.push(event); });
    const subscribed = await client.request("subscribe", { sessionId: worker });
    assert.equal(subscribed.streamId, before.streamId);
    await action(worker, "tool-mode", { mode: "direct" });
    await toggle(worker, "tool:switch_probe", false);
    await toggle(worker, "kernel:read", false);
    await toggle(worker, "kernel:module_switch_probe", false);
    await toggle(worker, `skill:${skillPath}`, false);
    assert.equal((await catalog()).requiresReload, false);
    assert.equal((await item(worker, "tool:switch_probe")).loaded, true);
    assert.equal((await client.request("nativeCapabilities", { sessionId: worker })).target.current.requiresReload, false);
    await run(worker, "kernel_code", { code: "assert retained_sentinel == 9031\ntry: gateway.switch_probe()\nexcept Exception as error: assert 'switch_probe 在本会话已关闭' in str(error), str(error)\nelse: raise AssertionError('closed tool executed')" });
    assert.equal(host.state(worker).streamId, before.streamId, "Switches preserve the SDK runtime");
    assert.equal(host.state(worker).kernel.kernelId, before.kernel.kernelId);
    await reload();
    const afterReload = host.state(worker);
    assert.notEqual(afterReload.streamId, before.streamId, "SDK/UI rebuild creates a new counter lifetime");
    const replacementFrames = reloadEvents.filter((event) => event.streamId === afterReload.streamId);
    assert.equal(replacementFrames[0]?.type, "snapshot", "an existing socket receives the replacement snapshot before its deltas");
    assert.equal(replacementFrames[0].details.snapshot.streamId, afterReload.streamId);
    const rendered = await action(worker, "extension-ui", { operation: "render", width: 80, height: 40, clientId: "stream-contract" });
    assert.equal(rendered.streamId, afterReload.streamId, "render replies carry the same ownership as snapshots and events");
    assert.equal((await catalog()).requiresReload, false);
    assert.equal(host.state(worker).sessionId, before.sessionId);
    assert.equal(host.state(worker).kernel.kernelId, before.kernel.kernelId, "Reload retains the exact kernel");
    assert(host.state(worker).messages.some((message) => message.role === "toolResult" && text(message) === text(manual.result)), "JSONL history survives SDK rebuild");
    const denied = await run(worker, "kernel_code", { code: `assert retained_sentinel == 9031\nassert callable(read)\nassert not any(t['name']=='switch_probe' for t in gateway.describe())\nfor invoke in [lambda: gateway.switch_probe(), lambda: gateway.describe('switch_probe'), lambda: gateway.skill_read(path=${JSON.stringify(skillPath)})]:\n    try: invoke()\n    except Exception: pass\n    else: raise AssertionError('disabled capability executed')\ntry: read('anything')\nexcept Exception as error: assert 'read' in str(error) and 'disabled for this session' in str(error), str(error)\nelse: raise AssertionError('disabled helper executed')\nprint('DENIAL_PROOF_9031')` });
    for (const request of denied.requests) {
      assert(!request.tools.includes("switch_probe"));
      assert(!request.prompt.includes("switch_probe"));
      assert(!request.prompt.includes("manual-probe"));
      assert(!JSON.stringify(request.declarations).includes("PLUGIN_DESCRIPTION_SWITCH_9031"), "Original codemode declaration cannot advertise an excluded tool");
    }
    assert.match(text(denied.result), /DENIAL_PROOF_9031/);
    const moduleDisabled = await run(worker, "kernel_code", { code: "assert callable(module_switch_probe)\ntry: module_switch_probe()\nexcept Exception as error: assert 'module_switch_probe' in str(error) and 'disabled for this session' in str(error), str(error)\nelse: raise AssertionError('disabled module executed')" });
    assert(moduleDisabled.requests.every((request) => !request.prompt.includes("MODULE_SWITCH_DESCRIPTION_9031")));
    await run(worker, "switch_probe", {}, true);
    const nativeDiscovery = await run(worker, "codemode", { code: "console.log(JSON.stringify(ALL_TOOLS.map(tool => tool.name)))" });
    assert(text(nativeDiscovery.result).includes("switch_probe"), "Native codemode retains registered callable tools; permission is enforced at invocation");
    const nativeDenied = await run(worker, "codemode", { code: "await tools.switch_probe({})" }, true);
    assert.match(text(nativeDenied.result), /switch_probe 在本会话已关闭/);
    await client.request("capabilitiesChange", { changes: [{ id: "tool:switch_probe", enabled: false }] });
    assert.equal((await item(inherited, "tool:switch_probe")).enabled, false);
    assert.equal((await catalog(inherited)).requiresReload, false, "Global switches immediately affect the untouched live session");
    await toggle(worker, "tool:switch_probe", true);
    assert.equal((await catalog()).requiresReload, false);
    await client.request("capabilitiesChange", { changes: [{ id: "tool:switch_probe", enabled: true }] });
    await client.request("capabilitiesChange", { changes: [{ id: "tool:switch_probe", enabled: false }] });
    assert.equal((await item(worker, "tool:switch_probe")).enabled, true, "Explicit override survives global change");
    assert.equal((await item(inherited, "tool:switch_probe")).enabled, false, "Untouched session follows current global default");
    assert.match(text((await run(worker, "switch_probe", {})).result), /PLUGIN_EXECUTED_9031/);
    await toggle(worker, "tool:switch_probe", null);
    assert.equal((await item(worker, "tool:switch_probe")).overridden, false);
    assert.equal((await item(worker, "tool:switch_probe")).enabled, false);
    assert.equal((await catalog()).requiresReload, false, "Reset rejoins current defaults without reload");
    await run(worker, "switch_probe", {}, true);
    await client.request("capabilitiesChange", { changes: [{ id: "tool:switch_probe", enabled: true }] });
    assert.equal((await item(worker, "tool:switch_probe")).enabled, true, "Reset rejoins global inheritance");
    await toggle(worker, "kernel:read", null);
    await toggle(worker, `skill:${skillPath}`, null);
    assert.equal((await catalog()).requiresReload, false);
    await run(worker, "kernel_code", { code: `assert 'MANUAL_SKILL_BODY_9031' in gateway.skill_read(path=${JSON.stringify(skillPath)})\nassert callable(read)` });
    await action(worker, "local-tools", { enabled: true });
    assert.equal((await catalog()).groups.find((group) => group.id === "group:tools:local").enabled, true);
    await toggle(worker, "group:tools:local", false);
    assert.equal((await client.request("nativeCapabilities", { sessionId: worker })).target.current.localTools, false);
    const persisted = structuredClone(parse(await readFile(join(home, "config.toml"), "utf8")));
    assert.equal(persisted.session.capabilities["tool:switch_probe"], true);
    assert.equal(persisted.session.noExtensions, false);
    await writeFile(join(plugin, "index.ts"), (await readFile(join(plugin, "index.ts"), "utf8")) + "\n// Registration file changed.\n");
    assert.equal((await catalog()).requiresReload, true, "Plugin file changes still require registration reload");
    await reload();
    assert.equal((await catalog()).requiresReload, false, "Resource reload captures the new file version");
    console.log("PASS capability layers: registered disabled tools, immediate permission/prompt switches, codemode denial, skill filtering, retained kernel/history, inheritance/reset and registration-file reload");
  });
} finally {
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  await rm(home, { recursive: true, force: true });
}
