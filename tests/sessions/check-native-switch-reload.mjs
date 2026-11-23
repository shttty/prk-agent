import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
// Real Gateway/SDK catalogs: switching registered tools never reloads or allocates a kernel.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Use only an owned Jupyter fixture");
const home = await mkdtemp(join(tmpdir(), "prk-native-reload-"));
const previousHome = process.env.HOME;
process.env.HOME = join(home, "gateway-home");
const cwd = join(process.env.HOME, "project");
const skillPath = join(process.env.HOME, ".agents/skills/native-reload-probe/SKILL.md");
try {
  await mkdir(cwd, { recursive: true });
  await mkdir(join(skillPath, ".."), { recursive: true });
  await writeFile(skillPath, "---\nname: native-reload-probe\ndescription: Native reload regression fixture\n---\nRead this fixture.\n");
  const { agentDir } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  await prepareNativeToolArtifacts(home);
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  await withTargetFixture(async ({ config, onCleanup }) => {
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "native-reload", models: [{ id: "controlled" }] });
    modelRuntime.registerNativeProvider(provider.provider);
    const host = await createGatewayHost({ cwd: home, home, model: "native-reload/controlled",
      config: parsePrkConfig({ monitor: { enabled: false }, memory: { review: false } }),
      targets: [false, true].map((local) => executionTargetFromConfig({ ...config, id: local ? "local" : "remote", label: "Fixture", local, sshCommand: local ? undefined : "exec /bin/sh", tags: [], cwd })),
    }, { runtimeDependencies: { cwd: home, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off" } });
    onCleanup(() => host.close());
    for (const target of ["remote", "local"]) {
      const worker = (await host.createSession({ target })).session.sessionId;
      const native = async (action, args) => {
        const result = await host.nativeAction(worker, { sessionId: worker, requestId: randomUUID(), action, ...(args ? { args } : {}) });
        assert.equal(result.status, "completed", JSON.stringify(result));
        return result.data;
      };
      const original = host.state(worker);
      for (const enabled of [true, false, true]) {
        await native("local-tools", { enabled });
        assert.equal(host.nativeCapabilities(worker).target.current.requiresReload, false, "Native switches take effect without reload");
        const catalog = await native("capabilities");
        assert.equal(catalog.requiresReload, false, `${target}/${enabled}: switches do not change registrations`);
        assert.equal(host.state(worker).streamId, original.streamId, "The same SDK runtime survives all switches");
        const skills = catalog.entries.filter((entry) => entry.id === `skill:${skillPath}`);
        assert.equal(skills.length, 1, "One skill identity must not shadow itself across target and Gateway discovery");
        assert.equal(skills[0].shadowedBy, undefined);
        assert.equal(skills[0].loaded, true);
        assert.equal(skills[0].group, target === "remote" ? `group:skills:dir:remote:${join(process.env.HOME, ".agents/skills")}` : "group:skills:global");
        const globalSkills = (await host.capabilitiesList()).catalog.entries.filter((entry) => entry.id === `skill:${skillPath}`);
        assert.equal(globalSkills.length, 1);
        assert.equal(globalSkills[0].group, "group:skills:global", "A session's target candidate must not change the global source");
        for (const name of ["read", "edit", "write"]) {
          const entry = catalog.entries.find((entry) => entry.id === `tool:${name}`);
          assert.equal(entry.enabled, enabled, `${target}/${enabled}: native file switch`);
          assert.equal(entry.loaded, true, `${target}/${enabled}: native tools stay registered`);
        }
        assert.equal(host.nativeCapabilities(worker).target.current.requiresReload, false);
        assert.equal(host.state(worker).kernel.state, "not_started", "Switching an unstarted kernel must not allocate one");
      }
    }
    console.log("PASS native switch: remote/local on/off/on catalogs apply immediately without SDK reload or starting a kernel.");
  }, { tempParent: home, allowHidden: true });
} finally {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(home, { recursive: true, force: true });
}
