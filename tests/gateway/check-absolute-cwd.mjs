import { parse, stringify } from "smol-toml";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { createSessionCollection } from "../../src/sessions/collection/assemble-collection.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

// Every place that writes a working directory (instance config load/add/edit, worker creation, retarget) accepts
// POSIX absolute paths only; relative ones are rejected with a message naming the requirement.
const isInvalid = (error) => error.code === "INVALID_REQUEST" && /absolute/.test(error.message);

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-absolute-cwd-"));
  let host;
  onCleanup(async () => {
    try { await host?.close(); } finally { await rm(root, { recursive: true, force: true }); }
  });
  const instancesPath = join(root, "instances.toml");
  const projectDir = join(root, "project");
  const goneDir = join(root, "gone");
  await mkdir(projectDir);
  await mkdir(goneDir);

  const first = { ...config, id: "local", label: "Local instance", tags: [], cwd: root };
  const second = { id: "second", label: "Second instance", local: false, tags: [], cwd: "/srv/work" };
  const withoutCwd = ({ cwd: _cwd, ...rest }) => rest;

  // Config load (parsePrkConfig is the one parser behind file load, reload, add and edit): cwd is required and absolute.
  for (const cwd of [".", "project", "./project", "~/project", "", undefined]) {
    assert.throws(() => parsePrkConfig({}, { instances: [{ ...first, cwd }] }), /requires cwd, an absolute path/, `instance cwd ${cwd}`);
  }
  assert.throws(() => parsePrkConfig({}, { instances: [withoutCwd(first)] }), /requires cwd, an absolute path/, "instance without cwd");
  assert.equal(parsePrkConfig({}, { instances: [first] }).instances[0].kernel.cwd, root);

  await writeFile(instancesPath, stringify({ instances: [first] }), { mode: 0o600 });
  const runtime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const provider = fauxProvider({ provider: "absolute-cwd", models: [{ id: "local" }] });
  runtime.registerNativeProvider(provider.provider);
  provider.setResponses([fauxAssistantMessage("unused")]);
  host = await createGatewayHost({ cwd: root, home: root, config: parsePrkConfig({ session: { workerTools: "direct" } }, { instances: [first] }), model: "absolute-cwd/local" }, {
    runtimeDependencies: { model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "low", cwd: root, agentDir: root },
  });

  // Instance add / edit.
  await assert.rejects(host.addTarget({ target: { ...second, cwd: "relative/dir" } }), /absolute path/);
  await assert.rejects(host.addTarget({ target: withoutCwd(second) }), /requires cwd/);
  await assert.rejects(host.editTarget({ target: { ...first, cwd: "project" } }), /absolute path/);
  assert.equal(host.getTarget("local").cwd, root, "a rejected edit leaves the saved cwd");
  assert.equal(structuredClone(parse(await readFile(instancesPath, "utf8"))).instances[0].cwd, root);
  await host.addTarget({ target: second });
  assert.equal(host.getTarget("second").cwd, "/srv/work");
  await host.editTarget({ target: { ...first, cwd: projectDir } });
  assert.equal(host.getTarget("local").cwd, projectDir);
  await host.editTarget({ target: { ...first, cwd: root } });

  // Worker creation: an explicit relative cwd is refused; no request cwd takes the instance's.
  for (const cwd of [".", "project", " ", "../up"]) {
    await assert.rejects(host.createSession({ target: "local", cwd }), isInvalid, `create cwd ${JSON.stringify(cwd)}`);
  }
  assert.equal(host.workbench().sessions.length, 0, "rejected creations leave no session behind");

  await prepareGatewayEnvironment(host, root, "local");
  const created = await host.createSession({ target: "local", cwd: goneDir });
  assert.equal(created.session.cwd, goneDir);
  const inherited = await host.createSession({ target: "local" });
  assert.equal(inherited.session.cwd, root, "omitted cwd takes the instance's absolute cwd");

  // Retarget (recovery with a new environment).
  // A closed worker whose directory vanished fails recovery and releases its binding, so it can be moved.
  await host.closeSession(created.session.sessionId);
  await rm(goneDir, { recursive: true });
  assert.equal((await host.recoverSession(created.session.sessionId, { mode: "auto" })).session.recovery.status, "unavailable");
  for (const cwd of [".", "project", "../up"]) {
    await assert.rejects(host.recoverSession(created.session.sessionId, { mode: "new", target: "local", cwd }), isInvalid, `retarget cwd ${cwd}`);
  }
  assert.equal(host.workbench().sessions.find((worker) => worker.sessionId === created.session.sessionId).cwd, goneDir, "a rejected retarget keeps the saved cwd");
  const moved = await host.recoverSession(created.session.sessionId, { mode: "new", target: "local", cwd: root });
  assert.equal(moved.session.cwd, root);
  // Runtime start rejects a relative stored cwd; observation never repairs persisted identity.
  const collection = createSessionCollection(parsePrkConfig({}, { instances: [first] }).instances, {});
  for (const options of [
    { mode: "wake", cwd: "proj" },
    { mode: "new", cwd: "." },
  ]) {
    await assert.rejects(collection.create("local", SessionManager.inMemory(root), options), /absolute cwd/, `${options.mode} with a relative stored cwd`);
  }
  await collection.close();
  console.log("PASS absolute cwd: strict load/add/edit/create/retarget/runtime inputs preserve saved state; absolute paths pass");
}, {});
