import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pc-"));
  let host, gateway, client, web;
  onCleanup(async () => {
    await web?.close(); client?.disconnect();
    if (gateway) await gateway.close(); else await host?.close();
    await rm(root, { recursive: true, force: true });
  });
  const { agentDir } = initializePrkHome(root);
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "project-create", models: [{ id: "controlled" }] });
  runtime.registerNativeProvider(provider.provider);
  host = await createGatewayHost({ cwd: root, home: root, model: "project-create/controlled",
    config: parsePrkConfig({ monitor: { enabled: false }, memory: { review: false } }),
    targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "fixture", local: true, cwd: root })],
  }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
  const socket = join(root, "g.sock");
  gateway = await startGateway(host, socket); client = await connectGateway(socket);
  web = await startWebApplication({ home: root, socket, host: "127.0.0.1", port: 0 });
  const create = async (extra = {}) => {
    const response = await fetch(`${web.server.url}/api/sessions`, { method: "POST", headers: { Origin: web.server.url, "Content-Type": "application/json" }, body: JSON.stringify({ target: "fixture", ...extra }) });
    return { status: response.status, body: await response.json() };
  };
  const seed = await create();
  assert.equal(seed.status, 201);
  const project = { id: "project-existing", name: "已有项目" };
  host.assignProject(seed.body.session.sessionId, project);
  const cases = {
    async existing() {
      const result = await create({ project });
      assert.equal(result.status, 201);
      assert.equal(result.body.session.projectId, project.id);
      assert.equal(result.body.session.projectName, project.name);
      assert.equal(host.state(result.body.session.sessionId).projectId, project.id);
    },
    async new() {
      const result = await create({ project: { name: "  新建项目  " } });
      assert.equal(result.status, 201);
      assert.equal(result.body.session.projectName, "新建项目");
      assert.match(result.body.session.projectId, /^project-/);
      assert.equal(host.state(result.body.session.sessionId).projectId, result.body.session.projectId);
      assert.equal(host.sessionControl().supervisors[result.body.session.projectId], result.body.session.sessionId);
    },
    async duplicate() {
      // Including an archived-only namesake must reject before any SDK file is created.
      await client.request("archiveProject", { projectId: project.id, confirm: true });
      const before = await readdir(join(root, "sessions"));
      const count = host.workbench().sessions.length;
      const result = await create({ project: { name: ` ${project.name} ` } });
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "INVALID_REQUEST");
      assert.equal(host.workbench().sessions.length, count);
      assert.deepEqual(await readdir(join(root, "sessions")), before);
      // assignProject and create share the very same duplicate-name rule.
      const other = await create();
      assert.throws(() => host.assignProject(other.body.session.sessionId, { id: "project-other", name: project.name }), (error) => error.code === "INVALID_REQUEST");
    },
    async ungrouped() {
      const result = await create();
      assert.equal(result.status, 201);
      assert.equal(result.body.session.projectId, undefined);
      assert.equal(host.state(result.body.session.sessionId).projectId, undefined);
    },
    async invalid() {
      const before = await readdir(join(root, "sessions"));
      for (const selection of [null, {}, { name: "" }, { id: "../bad", name: "Bad" }, { name: "Bad", extra: true }]) {
        assert.equal((await create({ project: selection })).status, 400);
      }
      assert.deepEqual(await readdir(join(root, "sessions")), before);
      assert.throws(() => client.request("createSession", { target: "fixture", project: null }));
    },
  };
  const selected = process.argv[2];
  const failures = [];
  for (const [name, run] of Object.entries(cases)) {
    if (selected && name !== selected) continue;
    try { await run(); console.log(`PASS project creation ${name}`); }
    catch (error) { failures.push(error); console.error(`FAIL project creation ${name}: ${error.stack}`); }
  }
  if (failures.length) throw new AggregateError(failures, "Project creation scenarios failed");
});
