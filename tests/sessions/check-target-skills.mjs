import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { TARGET_MODULE_SOURCES } from "../../src/target-channel/deployment-source/assemble-runtime-source.ts";
import { verifyInstanceSettings } from "../fixtures/target-skills/verify-instance-settings.mjs";
import { verifySkillReads } from "../fixtures/target-skills/verify-skill-reads.mjs";

const root = await mkdtemp(join(tmpdir(), "prk-target-skills-"));
const previousHome = process.env.HOME;
process.env.HOME = join(root, "gateway-home");
const { agentDir } = initializePrkHome(join(root, "prk"));
await mkdir(agentDir, { recursive: true });
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { connectWebGateway } = await import("../../src/http/gateway-connection/connect-gateway.ts");
const { startWebServer } = await import("../../src/http/listener/start-listener.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
try {
  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
    assert(tempRoot, "Owned fixture required");
    const near = join(tempRoot, "a/b/c/.agents/skills");
    const far = join(tempRoot, "a/b/.agents/skills");
    const outside = join(tempRoot, "a/.agents/skills");
    const targetHome = join(tempRoot, ".agents/skills");
    const globalHome = join(process.env.HOME, ".agents/skills");
    const cwd = join(tempRoot, "a/b/c");
    await mkdir(cwd, { recursive: true });
    await mkdir(join(tempRoot, "a/b/.git"));
    for (const [directory, name, body] of [[near, "x", "NEAR_BODY_27391"], [far, "x", "FAR_BODY_27391"], [outside, "z", "OUTSIDE_BODY_27391"], [targetHome, "x", "INSTANCE_BODY_27391"], [targetHome, "y", "HOME_BODY_27391"], [globalHome, "x", "GLOBAL_BODY_27391"], [globalHome, "gateway-only", "GATEWAY_ONLY_BODY_27391"]]) {
      await mkdir(join(directory, name), { recursive: true });
      await writeFile(join(directory, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${body}\n---\n${body}\n`);
    }
    await mkdir(join(near, "broken"));
    await writeFile(join(near, "broken/SKILL.md"), "---\nname: [invalid\n---\nnot valid YAML\n");
    await writeFile(join(near, "x/support.txt"), "SUPPORT_BODY_27391\n");
    await mkdir(join(near, "x/references"));
    await writeFile(join(near, "x/references/extra.md"), "---\nname: reference-extra\ndescription: Supporting reference, not a separate skill.\n---\nREFERENCE_BODY_27391\n");
    for (const directory of [near, targetHome, globalHome]) {
      for (const [file, name] of [["docs/a.md", "loose-doc"], ["root.md", "root"], ["x/references/r.md", "reference-r"], ["x/sub/SKILL.md", "nested"], ["d1/d2/d3/d4/d5/d6/SKILL.md", "depth-six"], ["e1/e2/e3/e4/e5/e6/e7/SKILL.md", "depth-seven"], ["venv/ignored/SKILL.md", "ignored-venv"], ["__pycache__/SKILL.md", "ignored-cache"], [".hidden/SKILL.md", "ignored-hidden"]]) {
        await mkdir(join(directory, file, ".."), { recursive: true });
        await writeFile(join(directory, file), `---\nname: ${name}\ndescription: Scanner fixture ${name}\n---\nSCANNER_BODY_${name}\n`);
      }
      for (const file of [".notes/info.txt", "node_modules/ignored.txt", ".git/ignored.txt", ".venv/ignored.txt", "venv/ignored.txt", "__pycache__/ignored.txt"]) {
        await mkdir(join(directory, "x", file, ".."), { recursive: true });
        await writeFile(join(directory, "x", file), "SUPPORT_CONTENT_NOT_READ_27391\n");
      }
    }
    const discovered = JSON.parse(execFileSync(process.env.PI_TEST_PYTHON ?? "python3", [
      "-c", "import json, sys; namespace = {'__name__': '<run_path>'}; exec(compile(sys.argv[1], 'target_channel/skills.py', 'exec'), namespace); print(json.dumps(namespace['discover'](sys.argv[2])))",
      TARGET_MODULE_SOURCES.skills, cwd,
    ], { encoding: "utf8", env: { ...process.env, HOME: tempRoot } }));
    assert.deepEqual(discovered.entries.filter((entry) => entry.path.startsWith(`${near}/x/`)).map((entry) => entry.path), [join(near, "x/SKILL.md")], "A skill root contributes only SKILL.md, not reference Markdown");
    assert.deepEqual(discovered.directories, [{ path: near }, { path: far }], "Project discovery stops at the git root and excludes target home");
    const expectedScanned = ["d1/d2/d3/d4/d5/d6/SKILL.md", "root.md", "x/SKILL.md"];
    assert.deepEqual(discovered.entries.filter((entry) => entry.path.startsWith(`${near}/`) && !entry.path.includes("/broken/")).map((entry) => entry.path.slice(near.length + 1)).sort(), expectedScanned, "Only root Markdown and terminal skill directories through depth six are discovered");
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "target-skills", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const home = join(root, "prk");
    const document = { session: { idleTimeoutMs: 60000, capabilities: { "tool:ask": false } }, memory: { review: false } };
    const instancesDocument = { instances: [
      { ...config, id: "fixture", label: "Fixture", local: false, sshCommand: "exec /bin/sh", tags: [], cwd, capabilities: { "tool:ask": true } },
    ] };
    for (const capabilities of [{ "group:skills:global": null }, { "group:skills:instance": true }, { "tool:ask": "false" }, { invalid: true }]) {
      assert.throws(() => parsePrkConfig(document, { instances: [{ ...instancesDocument.instances[0], capabilities }] }), /capabilities/);
    }
    await writeFile(join(home, "config.toml"), stringify(document));
    await writeFile(join(home, "instances.toml"), stringify(instancesDocument), { mode: 0o600 });
    const host = await createGatewayHost({ cwd: root, home, config: parsePrkConfig(document, instancesDocument), model: "target-skills/controlled" }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir } });
    const endpoint = await startGateway(host, join(root, "gateway.sock"));
    onCleanup(() => endpoint.close());
    const client = await connectGateway(join(root, "gateway.sock"));
    onCleanup(() => client.disconnect());
    const adapter = await connectWebGateway({ socket: join(root, "gateway.sock") });
    onCleanup(() => adapter.close());
    const web = await startWebServer(adapter, { port: 0 });
    onCleanup(() => web.close());
    const worker = (await client.request("createSession", { target: "fixture" })).session.sessionId;
    const action = async (action, args) => {
      const result = await client.request("nativeAction", { sessionId: worker, requestId: crypto.randomUUID(), action, ...(args ? { args } : {}) });
      assert.equal(result.status, "completed", JSON.stringify(result));
      return result.data;
    };
    const catalog = () => action("capabilities");
    const initial = await catalog();
    const groups = initial.groups.filter((group) => group.kind === "skill" && group.path?.startsWith(`${tempRoot}/`));
    assert.deepEqual(groups.map(({ id, path, machine }) => ({ id, path, machine })), [
      ...[near, far].map((path) => ({ id: `group:skills:dir:fixture:${path}`, path, machine: "fixture" })),
    ], "Only target project directories contribute target skill groups");
    const globalGroup = initial.groups.find((group) => group.id === "group:skills:global");
    assert.equal(globalGroup.path, globalHome);
    assert.equal(globalGroup.machine, "gateway");
    assert(initial.groups.indexOf(globalGroup) > initial.groups.findIndex((group) => group.id === `group:skills:dir:fixture:${far}`));
    assert(!initial.groups.some((group) => group.id === "group:skills:instance"));
    assert(!initial.entries.some((entry) => entry.kind === "skill" && entry.source.startsWith(`${targetHome}/`)), "Neither same-name nor target-only home skills enter the session catalog");
    for (const directory of [near, globalHome]) {
      const expected = directory === globalHome ? [...expectedScanned, "gateway-only/SKILL.md"].sort() : expectedScanned;
      assert.deepEqual(initial.entries.filter((entry) => entry.kind === "skill" && entry.source.startsWith(`${directory}/`)).map((entry) => entry.source.slice(directory.length + 1)).sort(), expected, "Gateway globals and target projects use identical .agents/skills scan rules");
    }
    const winner = `skill:${near}/x/SKILL.md`;
    const loser = `skill:${far}/x/SKILL.md`;
    assert.equal(initial.entries.find((entry) => entry.id === loser).shadowedBy, winner);
    assert.equal(initial.entries.find((entry) => entry.id === winner).shadowedBy, undefined);
    assert.equal(initial.entries.find((entry) => entry.id === `skill:${globalHome}/x/SKILL.md`).shadowedBy, winner);
    assert.equal(initial.requiresReload, false);
    assert.equal(initial.entries.find((entry) => entry.id === "tool:ask").defaultEnabled, true, "Configured instance defaults beat the global default on initial load");
    assert(!(await client.request("capabilitiesList")).catalog.entries.some((entry) => entry.id === winner), "Global catalog never includes target paths");
    const { settings, addHomeSkill } = await verifyInstanceSettings({ web, targetHome, globalHome, catalog, action, winner, home, cwd });
    await action("reload");
    await action("tool-mode", { mode: "direct" });
    await verifySkillReads({ provider, host, sessionId: worker, action, catalog, near, far, targetHome, globalHome, winner, loser, client, web, home });
    await client.request("closeSession", { sessionId: worker });
    const connectionSkill = await addHomeSkill("connection-change");
    assert(!(await settings("fixture")).catalog.entries.some((entry) => entry.id === connectionSkill));
    const { capabilities: _instanceDefaults, ...instanceConfig } = instancesDocument.instances[0];
    await client.request("editTarget", { target: { ...instanceConfig, cwd: tempRoot } });
    assert(!(await settings("fixture")).catalog.entries.some((entry) => entry.id === connectionSkill), "Editing the instance connection must not restore target-home skills");
    await client.request("deleteTarget", { target: "fixture", confirm: true });
    const replacementSkill = await addHomeSkill("replacement-instance");
    await client.request("addTarget", { target: instanceConfig });
    assert(!(await settings("fixture")).catalog.entries.some((entry) => entry.id === replacementSkill), "Reusing an instance name must not discover target home");
    const createdSkill = await addHomeSkill("creation-discovery");
    const createdWorker = (await client.request("createSession", { target: "fixture" })).session.sessionId;
    const afterCreationSkill = await addHomeSkill("after-creation");
    const createdView = await settings("fixture");
    assert(!createdView.catalog.entries.some((entry) => entry.id === createdSkill), "Session creation excludes existing target-home skills");
    assert(!createdView.catalog.entries.some((entry) => entry.id === afterCreationSkill), "Instance GET excludes newly added target-home skills");
    await client.request("closeSession", { sessionId: createdWorker });
    await endpoint.close();
    process.env.HOME = tempRoot;
    const localInstances = { instances: [{ ...instancesDocument.instances[0], local: true }] };
    const localHost = await createGatewayHost({ cwd: root, home, config: parsePrkConfig(document, localInstances), model: "target-skills/controlled" }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir } });
    onCleanup(() => localHost.close());
    const localSettings = await localHost.capabilitiesList("fixture");
    assert(!localSettings.catalog.groups.some((group) => group.id === "group:skills:instance"), "Local instance home is already global");
    const localWorker = (await localHost.createSession({ target: "fixture" })).session.sessionId;
    const localResult = await localHost.nativeAction(localWorker, { sessionId: localWorker, requestId: crypto.randomUUID(), action: "capabilities" });
    assert.equal(localResult.status, "completed");
    const localSkills = localResult.data.groups.filter((group) => group.kind === "skill");
    assert.deepEqual(localSkills.map((group) => group.id), [
      ...[near, far].map((path) => `group:skills:dir:fixture:${path}`),
      ...localSettings.catalog.groups.filter((group) => group.kind === "skill").map((group) => group.id),
    ], "Local home does not reorder existing Gateway sources");
    assert.deepEqual([localSkills[0].path, localSkills[0].machine], [near, "fixture"]);
    console.log("PASS target skills: project > Gateway global discovery and fallback, target-home exclusion/read refusal across refresh/reload/reconnect, instance defaults/reset/validation, session overrides, channel reads, shared-library scope filtering and usage");
  }, { allowHidden: true });
} finally {
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
