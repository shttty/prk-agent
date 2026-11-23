// Real SDK + owned REPL: missing cwd/target fails explicitly; selecting target/cwd persists across restarts.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";

const text = (message) => typeof message?.content === "string" ? message.content
  : (Array.isArray(message?.content) ? message.content : []).map((part) => part?.text ?? "").join("");

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "pi-workspace-retarget-")));
  const directory = join(root, "history");
  const first = join(root, "workspace-a");
  const second = join(root, "workspace-b");
  await mkdir(first);
  await mkdir(second);
  let host;
  onCleanup(async () => {
    await host?.close().catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const faux = fauxProvider({ provider: "retarget-controlled", models: [{ id: "local" }], tokensPerSecond: 5000 });
  modelRuntime.registerNativeProvider(faux.provider);
  faux.setResponses(Array.from({ length: 20 }, () => async (context) => context.messages.at(-1)?.role === "toolResult"
    ? fauxAssistantMessage("cwd reported")
    : fauxAssistantMessage(fauxToolCall("kernel_code", { code: "import os\nprint('CWD=' + os.getcwd())" }), { stopReason: "toolUse" })));
  const target = (name) => executionTargetFromConfig({ ...config, id: name, label: name, tags: [], cwd: root });
  const options = (targets) => ({ cwd: root, home: root, config: parsePrkConfig({ session: { workerTools: "direct" } }), historyDir: directory, model: "retarget-controlled/local", targets });
  const dependencies = { runtimeDependencies: { model: faux.getModel(), modelRuntime, thinkingLevel: "low", cwd: root, agentDir: root } };
  async function reportedCwd(name) {
    const worker = host.session(name);
    const start = worker.getSnapshot().messages.length;
    const operation = await worker.submit({ requestId: `cwd-${Date.now()}`, message: "Report the working directory." });
    assert(operation.accepted, JSON.stringify(operation));
    assert.equal((await operation.completion).status, "completed");
    const result = worker.getSnapshot().messages.slice(start).find((message) => message.role === "toolResult");
    return /CWD=(.*)/.exec(text(result))?.[1]?.trim();
  }
  const get = (name) => host.workbench().sessions.find((worker) => worker.sessionId === name);

  host = await createGatewayHost(options([target("stable")]), dependencies);
  const created = await host.createSession({ target: "stable", cwd: first });
  const name = created.session.sessionId;
  assert.equal(await reportedCwd(name), first, "The worker starts in its chosen working directory");
  await host.closeSession(name);

  // A vanished cwd fails instead of starting in its parent directory.
  await rm(first, { recursive: true });
  const missing = await host.recoverSession(name, { mode: "auto" });
  assert.equal(missing.session.recovery.status, "unavailable");
  assert.equal(get(name).cwd, first, "A failed recovery keeps the saved selection");

  // A failed forced move restores the previous selection.
  const failedMove = await host.recoverSession(name, { mode: "new", target: "stable", cwd: join(root, "not-there") });
  assert.equal(failedMove.session.recovery.status, "unavailable");
  assert.equal(get(name).cwd, first, "A failed forced move restores the previous working directory");

  // Force the session into a new working directory on the same target.
  const moved = await host.recoverSession(name, { mode: "new", target: "stable", cwd: second });
  assert.equal(moved.session.recovery.status, "new");
  assert.equal(get(name).cwd, second);
  assert.equal(await reportedCwd(name), second, "The new kernel runs in the new working directory");
  await host.closeSession(name);
  await host.close();

  // The target itself is gone after a restart: explicit refusal, then a forced move to another target.
  host = await createGatewayHost(options([target("replacement")]), dependencies);
  assert.equal(get(name).target, "stable", "History keeps the saved target");
  const orphaned = await host.recoverSession(name, { mode: "auto" });
  assert.equal(orphaned.session.recovery.status, "unavailable");
  await assert.rejects(host.recoverSession(name, { mode: "new", target: "stable" }), (error) => error.code === "NOT_FOUND");
  await assert.rejects(host.recoverSession(name, { mode: "new", cwd: second }), (error) => error.code === "INVALID_REQUEST");
  const rehomed = await host.recoverSession(name, { mode: "new", target: "replacement", cwd: second });
  assert.equal(rehomed.session.recovery.status, "new");
  assert.equal(get(name).target, "replacement");
  assert.equal(await reportedCwd(name), second);
  await host.closeSession(name);
  await host.close();

  host = await createGatewayHost(options([target("replacement")]), dependencies);
  assert.equal(get(name).target, "replacement", "The forced move survives a restart");
  assert.equal(get(name).cwd, second);
  console.log("PASS workspace retarget: missing cwd/target refused, failed move preserves selection, forced new cwd/target executes there and survives restart");
});
