import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { createSessionHistory } from "../../src/sessions/history/assemble-history.ts";

const home = await mkdtemp(join(tmpdir(), "prk-project-date-"));
const historyDir = join(home, "sessions");
const projectPath = (id) => join(home, "memories/projects", id, "project.json");
const record = async (id) => JSON.parse(await readFile(projectPath(id), "utf8"));
const stamp = "2025-11-16T12:00:00.000Z";
let host;
try {
  const { agentDir } = initializePrkHome(home);
  const legacy = await createSessionHistory({ cwd: home, directory: historyDir });
  const old = { id: "old", name: "Old" }, registered = { id: "registered", name: "Registered" };
  const seed = (project) => {
    const manager = legacy.create("fixture", project.name, home);
    legacy.assignProject(manager.getSessionId(), project);
    return manager;
  };
  const oldest = seed(old), visible = seed(old), registeredSession = seed(registered);
  legacy.archive(oldest.getSessionId(), oldest.getSessionId(), false);
  const file = oldest.getSessionFile();
  const [header, ...entries] = (await readFile(file, "utf8")).split("\n");
  await writeFile(file, [JSON.stringify({ ...JSON.parse(header), timestamp: stamp }), ...entries].join("\n"));
  const existing = { ...registered, created: "2024-07-21T11:00:00.000Z", archived: false, other: "keep" };
  await mkdir(join(home, "memories/projects", registered.id), { recursive: true });
  await writeFile(projectPath(registered.id), JSON.stringify(existing));
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "project-date", models: [{ id: "fixture" }] });
  modelRuntime.registerNativeProvider(provider.provider);
  host = await createGatewayHost({ cwd: home, home, historyDir, model: "project-date/fixture",
    config: parsePrkConfig({ memory: { enabled: false }, monitor: { enabled: false } }),
    targets: [executionTargetFromConfig({ id: "fixture", label: "fixture", local: true, cwd: home })],
  }, { runtimeDependencies: { cwd: home, agentDir, model: provider.getModel(), modelRuntime, noSkills: true } });
  const rows = host.workbench().sessions;
  assert.equal((await record(old.id)).created, stamp);
  assert.equal(rows.find((row) => row.sessionId === visible.getSessionId()).projectCreated, stamp);
  assert.equal(rows.find((row) => row.sessionId === registeredSession.getSessionId()).projectCreated, existing.created);
  assert.deepEqual(await record(registered.id), existing);
  const created = (await host.createSession({ target: "fixture", project: { name: "Fresh" } })).session;
  assert.equal(created.state, "sleeping", "no runtime or memory render before the record exists");
  assert.equal((await record(created.projectId)).created, created.projectCreated);
  assert(Number.isFinite(Date.parse(created.projectCreated)));
  const assigned = host.assignProject(visible.getSessionId(), { id: "new-project", name: "New assignment" });
  assert.equal((await record("new-project")).created, assigned.projectCreated);
  assert(Date.parse(assigned.projectCreated) > Date.parse(stamp));
  console.log("project dates PASS: persisted without runtime, assignment, archived oldest backfill, existing date preserved");
} finally {
  await host?.close();
  await rm(home, { recursive: true, force: true });
}
