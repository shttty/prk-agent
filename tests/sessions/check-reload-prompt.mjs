import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
// Real Gateway/Pi/target-channel reload; one Gateway skill also reachable from the local cwd.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { preserveGatewaySkillCandidates } from "../../src/sessions/resource-catalog/preserve-gateway-skill-candidates.ts";

assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Use only an owned Jupyter fixture");
const root = await mkdtemp(join(tmpdir(), "prk-reload-prompt-"));
const previousHome = process.env.HOME;
process.env.HOME = join(root, "gateway-home");
try {
  const home = join(root, "prk");
  const cwd = join(process.env.HOME, "project");
  const skillPath = join(process.env.HOME, ".agents/skills/reload-probe/SKILL.md");
  await mkdir(cwd, { recursive: true });
  await mkdir(dirname(skillPath), { recursive: true });
  const skillSource = "---\nname: reload-probe\ndescription: Reload regression fixture\n---\nRead this fixture.\n";
  await writeFile(skillPath, skillSource);
  const { agentDir } = initializePrkHome(home);
  const pluginPath = join(agentDir, "extensions/reload-probe.js");
  const pluginSource = 'export default function(pi) { pi.registerTool({ name: "reload_probe", label: "Reload probe", description: "Registration reload fixture", parameters: { type: "object", properties: {} }, execute: async () => ({ content: [{ type: "text", text: "probe" }], details: {} }) }); }\n';
  await mkdir(dirname(pluginPath), { recursive: true });
  await writeFile(pluginPath, pluginSource);
  const duplicatePath = join(agentDir, "skills/reload-probe/SKILL.md");
  await mkdir(dirname(duplicatePath), { recursive: true });
  await writeFile(duplicatePath, skillSource);
  const { ModelRuntime, loadSkills } = await import("@earendil-works/pi-coding-agent");
  const discovered = loadSkills({ cwd, agentDir, includeDefaults: false, skillPaths: [skillPath, duplicatePath] });
  assert.equal(discovered.diagnostics.filter(({ collision }) => collision?.resourceType === "skill").length, 1);
  const candidates = preserveGatewaySkillCandidates(discovered, cwd, agentDir);
  assert.deepEqual(candidates.skills.map(({ filePath }) => filePath), [skillPath, duplicatePath], "All Pi-discovered same-name candidates survive until current switches select a winner");
  const { fauxProvider } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  await withTargetFixture(async ({ config, onCleanup }) => {
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "reload-prompt", models: [{ id: "controlled" }] });
    modelRuntime.registerNativeProvider(provider.provider);
    const host = await createGatewayHost({ cwd: home, home, model: "reload-prompt/controlled",
      config: parsePrkConfig({ session: { noExtensions: false }, monitor: { enabled: false }, memory: { review: false } }),
      targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "Fixture", local: true, tags: [], cwd })],
    }, { runtimeDependencies: { cwd: home, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off" } });
    onCleanup(() => host.close());
    const worker = (await host.createSession({ target: "fixture" })).session.sessionId;
    const native = async (action, args) => {
      const result = await host.nativeAction(worker, { sessionId: worker, requestId: randomUUID(), action, ...(args ? { args } : {}) });
      assert.equal(result.status, "completed", JSON.stringify(result));
      return result.data;
    };
    await native("capabilities", { changes: [{ id: "tool:ask", enabled: false }] });
    assert.equal((await native("capabilities")).requiresReload, false, "Pure switches do not require resource reload");
    await native("reload");
    const catalog = await native("capabilities");
    const unregistered = catalog.entries.filter((entry) => entry.available !== false && !entry.loaded);
    assert.equal(catalog.requiresReload, false, `Reload must settle resource registration: ${JSON.stringify(unregistered)}`);
    assert.equal(catalog.entries.find((entry) => entry.id === "tool:ask").loaded, true, "Disabled tools remain registered");
    const skills = catalog.entries.filter((entry) => entry.id === `skill:${skillPath}`);
    assert.equal(skills.length, 1, "One local Gateway skill must not shadow itself");
    assert.equal(skills[0].loaded, true);
    assert.equal(skills[0].group, "group:skills:global");
    await writeFile(pluginPath, `${pluginSource}// Changed plugin source.\n`);
    assert.equal((await native("capabilities")).requiresReload, true, "A registered plugin file edit still requires reload");
    await native("reload");
    assert.equal((await native("capabilities")).requiresReload, false);
    await writeFile(skillPath, `${skillSource}Changed skill body.\n`);
    assert.equal((await native("capabilities")).requiresReload, true, "A registered skill file edit still requires reload");
    await native("reload");
    assert.equal((await native("capabilities")).requiresReload, false);
    assert.equal(host.state(worker).kernel.state, "not_started", "Resource reload needs no kernel or model call");
    console.log("PASS resource reload: switches preserve registration, plugin/skill edits require reload, Gateway skills deduplicate without a kernel or model call.");
  }, { tempParent: root, allowHidden: true });
} finally {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
