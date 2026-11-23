import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";

assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");
const root = await mkdtemp(join(tmpdir(), "prk-instance-environment-"));
const previous = { HOME: process.env.HOME, PRK_HOME: process.env.PRK_HOME };
process.env.HOME = join(root, "gateway-user");
const home = process.env.PRK_HOME = join(root, "home");
const targetHome = join(root, "target-user");
const { agentDir } = initializePrkHome(home);
let host;
try {
  await mkdir(process.env.HOME, { recursive: true });
  await mkdir(targetHome, { recursive: true });
  await mkdir(agentDir, { recursive: true });
  await prepareNativeToolArtifacts(home);
  await writeFile(join(agentDir, "models.json"), JSON.stringify({ providers: { owned: { baseUrl: "http://127.0.0.1:1/v1", apiKey: "unused", api: "openai-responses", models: [{ id: "manual", name: "manual", input: ["text"], reasoning: false, contextWindow: 4096, maxTokens: 128, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  await writeFile(join(agentDir, "settings.json"), "{}\n");
  const config = parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, codemode: { binChunkBytes: 262144 }, session: { noExtensions: false, noSkills: true, bootstrapNoSkills: true } }, { instances: [
    { id: "remote", label: "Owned remote", local: false, sshCommand: `HOME='${targetHome}' exec /bin/sh`, python: process.env.PI_TEST_PYTHON, cwd: root },
    { id: "pending", label: "Pending", cwd: root },
  ] });
  host = await createGatewayHost({ cwd: home, home, config, targets: config.instances, model: "owned/manual", thinkingLevel: "off" });
  const events = [];
  let completion;
  const unsubscribe = host.subscribeSessions((event) => {
    if (event.type !== "target_environment_changed") return;
    const snapshot = event.details.environment;
    console.log(JSON.stringify({ at: Date.now(), environment: snapshot }));
    events.push(snapshot);
    if (snapshot.status === "ready" || snapshot.status === "failed") completion?.resolve(snapshot);
  });
  assert.equal(host.getTargetEnvironment({ target: "remote" }).status, "idle");
  await assert.rejects(host.createSession({ target: "remote", cwd: root }), (error) => error.code === "ENVIRONMENT_REQUIRED" && error.details.environment.target === "remote");
  assert.deepEqual(host.workbench().sessions, [], "cold create does not write a session before deployment");
  completion = Promise.withResolvers();
  const first = host.deployTargetEnvironment({ target: "remote" });
  const joined = host.deployTargetEnvironment({ target: "remote" });
  assert.equal(joined.streamId, first.streamId);
  assert.equal(joined.revision, first.revision, "a second request joins the current task without resetting it");
  const ready = await completion.promise;
  assert.equal(ready.status, "ready", JSON.stringify(ready));
  assert(ready.totalBytes > 0);
  assert.equal(ready.transferredBytes, ready.totalBytes);
  assert.equal(ready.percent, 100);
  assert(events.some((entry) => entry.bytesPerSecond > 0));
  assert(events.every((entry, index) => !index || entry.revision > events[index - 1].revision));
  const created = await host.createSession({ target: "remote", cwd: root });
  assert(created.session.sessionId);
  assert.equal(host.workbench().sessions.length, 1);
  completion = Promise.withResolvers();
  host.deployTargetEnvironment({ target: "remote" });
  const cached = await completion.promise;
  assert.equal(cached.status, "ready");
  assert.equal(cached.totalBytes, 0);
  assert.equal(cached.transferredBytes, 0);
  await rm(join(targetHome, ".cache", "prk", "bin"), { recursive: true, force: true });
  await assert.rejects(host.createSession({ target: "remote", cwd: root }), (error) => error.code === "ENVIRONMENT_REQUIRED" && error.details.environment.status === "idle");
  assert.equal(host.workbench().sessions.length, 1, "missing binary cache does not enqueue or create another session");
  const pending = await host.createSession({ target: "pending", cwd: root });
  assert(pending.session.sessionId, "pending instances preserve history-only creation");
  assert.equal(host.getTargetEnvironment({ target: "pending" }).status, "idle");
  unsubscribe();
  console.log("PASS instance environment: cold refusal before session identity, shared task and ACK progress, warm create, zero-byte cache reuse, separate binary cache gate, pending history-only creation");
} finally {
  await host?.close();
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await rm(root, { recursive: true, force: true });
}
