import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "../../src/artifacts/store/assemble-store.ts";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { buildDirectoryPackage } from "../../src/remote-extensions/bundle/build-directory-package.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createHostFixture } from "../target-environment/host/create-host-fixture.mjs";

const root = await mkdtemp(join(tmpdir(), "prk-plugin-artifact-"));
const previousHome = process.env.HOME;
process.env.HOME = root;
const home = join(root, "prk");
const { agentDir } = initializePrkHome(home);
const store = new ArtifactStore(join(home, "assets"));
let fixture;
let host;
try {
  await mkdir(agentDir, { recursive: true });
  const source = join(root, "changing");
  await mkdir(source);
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "@prk-tests/changing", version: "1.0.0", type: "module", pi: { extensions: ["index.mjs"] } }));
  await writeFile(join(source, "index.mjs"), "export default pi => pi.registerCommand('revision_one',{handler:async()=>{}});\n");
  const first = await buildDirectoryPackage(store, source);
  const cache = join(store.directory, "plugin-builds", (await readdir(join(store.directory, "plugin-builds")))[0]);
  const before = (await stat(cache)).mtimeMs;
  assert.deepEqual(await buildDirectoryPackage(store, source), first);
  assert.equal((await stat(cache)).mtimeMs, before, "Unchanged content reuses the existing build, without rewriting its cache record");
  await writeFile(join(source, "index.mjs"), "export default pi => pi.registerCommand('revision_two',{handler:async()=>{}});\n");
  const second = await buildDirectoryPackage(store, source);
  assert.notEqual(second.bundle, first.bundle, "Same version with changed directory contents produces a new content-addressed artifact");
  await unlink(join(source, "index.mjs"));
  await assert.rejects(buildDirectoryPackage(store, source), /does not declare any Pi extensions/);
  await writeFile(join(source, "index.mjs"), "export default () => {};\n");
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "@prk-tests/changing", type: "module", pi: { extensions: ["index.mjs"] } }));
  const healthy = join(root, "healthy");
  await mkdir(healthy);
  await writeFile(join(healthy, "package.json"), JSON.stringify({ name: "@prk-tests/healthy", version: "1.0.0", type: "module", pi: { extensions: ["index.mjs"] } }));
  await writeFile(join(healthy, "index.mjs"), "export default pi => pi.registerCommand('healthy',{handler:async()=>console.log('P1_HEALTHY_EXECUTED '+process.pid)});\n");
  fixture = await createHostFixture("local", store);
  let executed = Promise.withResolvers();
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider } = await import("@earendil-works/pi-ai");
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider(); runtime.registerNativeProvider(provider.provider);
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [source, healthy].map((source) => ({ source, enabled: true, location: "host" })) }));
  const config = parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, remoteHost: { runtime: "node" }, session: { noSkills: true, bootstrapNoSkills: true } }, {
    instances: [{ id: "owned", label: "Owned artifact transport", local: false, sshCommand: fixture.fixture.command, python: process.env.PI_TEST_PYTHON, cwd: fixture.fixture.root }],
  });
  host = await createGatewayHost({ cwd: home, home, config, targets: config.instances, model: `${provider.getModel().provider}/${provider.getModel().id}` }, {
    runtimeDependencies: { model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off", cwd: home, agentDir, targetChannels: fixture.channels },
    onRemoteExtensionEvent(event) { if (String(event.data).includes("P1_HEALTHY_EXECUTED")) executed.resolve(String(event.data)); },
  });
  if (!process.argv.includes("--build-phase-only")) {
  await prepareGatewayEnvironment(host, home, "owned");
  const created = await host.createSession({ target: "owned", cwd: fixture.fixture.root });
  const statuses = (await host.pluginsList()).packages;
  assert.match(statuses.find(({ source: value }) => value === source).error, /must have name and version/);
  assert.equal(statuses.find(({ source: value }) => value === source).errorCode, "PLUGIN_BUILD_FAILED");
  assert.equal(statuses.find(({ source: value }) => value === healthy).error, undefined);
  await host.nativeSend(created.session.sessionId, { sessionId: created.session.sessionId, requestId: "p1-healthy", message: "/healthy", mode: "auto" });
  console.log(JSON.stringify({ first: first.bundle, second: second.bundle, changedVersion: false, noStaleFallback: true, healthy: await executed.promise, statuses }));
  }
  const failingManifest = { name: "@prk-tests/changing", version: "1.0.0", type: "module", pi: { extensions: ["index.mjs"] }, files: ["package.json"] };
  await writeFile(join(source, "package.json"), JSON.stringify(failingManifest));
  await prepareGatewayEnvironment(host, home, "owned");
  const buildFailure = (await host.pluginsList()).packages.find(({ source: value }) => value === source);
  assert.equal(buildFailure.errorCode, "PLUGIN_BUILD_FAILED");
  assert.match(buildFailure.errorDetails.packageHash, /^[a-f0-9]{64}$/);
  executed = Promise.withResolvers();
  const failedBuildSession = await host.createSession({ target: "owned", cwd: fixture.fixture.root });
  await host.nativeSend(failedBuildSession.session.sessionId, { sessionId: failedBuildSession.session.sessionId, requestId: "p1-build-healthy", message: "/healthy", mode: "auto" });
  console.log(JSON.stringify({ hashedBuildFailure: buildFailure, healthy: await executed.promise }));
  await writeFile(join(source, "package.json"), JSON.stringify({ ...failingManifest, description: "new failing packed content" }));
  await assert.rejects(host.createSession({ target: "owned", cwd: fixture.fixture.root }), (error) => error.code === "ENVIRONMENT_REQUIRED", "an old failure never excuses unchecked new content");
  await writeFile(join(source, "package.json"), "{invalid manifest");
  await prepareGatewayEnvironment(host, home, "owned");
  executed = Promise.withResolvers();
  const secondSession = await host.createSession({ target: "owned", cwd: fixture.fixture.root });
  const malformed = (await host.pluginsList()).packages;
  assert(malformed.find(({ source: value }) => value === source).error, "invalid package metadata stays a per-package error");
  assert.equal(malformed.find(({ source: value }) => value === healthy).error, undefined);
  await host.nativeSend(secondSession.session.sessionId, { sessionId: secondSession.session.sessionId, requestId: "p1-healthy-again", message: "/healthy", mode: "auto" });
  console.log(JSON.stringify({ malformedManifestIsolated: true, healthy: await executed.promise, statuses: malformed }));
  console.log("PASS P1 through P6: package build/manifest failures remain isolated, healthy real host command executes, changed content requires deployment, no stale fallback");
  // npm can publish a dangling local dependency link; target extraction must reject it globally.
  await writeFile(join(source, "package.json"), JSON.stringify({ ...failingManifest, files: ["index.mjs"], dependencies: { "owned-missing-dependency": `file:${join(root, "missing-dependency")}` } }));
  const countBeforeFailure = host.workbench().sessions.length;
  const failedTransfer = Promise.withResolvers();
  const unsubscribe = host.subscribeSessions((event) => {
    if (event.type === "target_environment_changed" && ["ready", "failed"].includes(event.details.environment.status)) failedTransfer.resolve(event.details.environment);
  });
  let failure;
  try { host.deployTargetEnvironment({ target: "owned" }); failure = await failedTransfer.promise; }
  finally { unsubscribe(); }
  assert.equal(failure.status, "failed");
  assert.match(failure.error.message, /bundle link escapes/);
  await assert.rejects(host.createSession({ target: "owned", cwd: fixture.fixture.root }), /bundle link escapes/);
  assert.equal(host.workbench().sessions.length, countBeforeFailure, "actual artifact validation failure cannot create a session");
  console.log(JSON.stringify({ transferValidationFailedGlobally: true, noNewSession: true, failure }));
} finally {
  await host?.close(); await fixture?.close();
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
