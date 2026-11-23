import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { assertProcessExited } from "../fixtures/target-environment/assert-process-exited.mjs";
import { checkBrowserRecovery } from "./failed-recovery/check-browser-recovery.mjs";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

// A failed or unknown operation stays on that operation: the session stays idle and the next input runs directly.
// A session without a usable runtime is "unavailable" with a reason; the next message tries to start one.
const root = await mkdtemp(join(tmpdir(), "prk-failed-recovery-"));
try {
  const { agentDir } = initializePrkHome(root);
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false } }));
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxAssistantMessage, fauxProvider, fauxToolCall } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
    const cwd = join(tempRoot, "worker-cwd");
    await mkdir(cwd);
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "failed-recovery", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const socket = join(root, "g.sock");
    const owner = {};
    const startOwner = async () => {
      owner.host = await createGatewayHost({
        cwd: root, home: root, historyDir: join(root, "history"), model: "failed-recovery/controlled", thinkingLevel: "off",
        config: parsePrkConfig({ session: { workerTools: "direct" } }),
        targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "Recovery fixture", tags: [], cwd })],
      }, { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir } });
      owner.gateway = await startGateway(owner.host, socket);
      owner.client = await connectGateway(socket);
    };
    const stopOwner = async () => {
      const { client, gateway } = owner;
      owner.client = owner.gateway = undefined;
      await client?.disconnect();
      await gateway?.close();
    };
    onCleanup(stopOwner);
    await startOwner();
    const request = (method, params) => owner.client.request(method, params);
    const listed = (name) => owner.host.workbench().sessions.find((item) => item.sessionId === name);
    const worker = await request("createSession", { target: "fixture" });
    let counter = 0;
    const settled = async (name, operationId) => {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        const state = await request("state", { sessionId: name });
        const outcome = state.recentOperations.find((item) => item.operationId === operationId);
        if (outcome && !state.operation) return { state, outcome };
        await new Promise((done) => setTimeout(done, 10));
      }
      throw new Error("Operation did not settle");
    };
    const send = async (name, message) => {
      const accepted = await request("send", { sessionId: name, requestId: `recovery-${++counter}`, message });
      assert.equal(accepted.accepted, true, JSON.stringify(accepted));
      return settled(name, accepted.operationId);
    };
    const refused = (name, message) => request("send", { sessionId: name, requestId: `refused-${++counter}`, message }).then(
      (value) => assert.fail(`input must not be admitted: ${JSON.stringify(value)}`),
      (error) => error,
    );
    const userCount = (state, marker) => state.messages.filter((message) => message.role === "user" && JSON.stringify(message.content).includes(marker)).length;
    const render = (name) => request("nativeAction", { sessionId: name, requestId: `render-${++counter}`, action: "extension-ui", args: { operation: "render", width: 80, height: 40, clientId: "recovery" } });
    const effects = join(cwd, "effects");

    {
      const created = worker;
      const name = created.session.sessionId;
      const error = fauxAssistantMessage("", { stopReason: "error", errorMessage: "TERMINAL_PROVIDER_FIXTURE_FAILURE" });
      provider.setResponses([
        fauxAssistantMessage(fauxToolCall("kernel_code", { code: `from pathlib import Path\np = Path(${JSON.stringify(effects)})\np.write_text(str(int(p.read_text()) + 1) if p.exists() else '1')\nrecovery_seed = 73\nprint(recovery_seed)` }), { stopReason: "toolUse" }), error,
      ]);
      const failed = await send(name, `FAILED_INPUT_${created.session.sessionId}`);
      assert.equal(failed.outcome.status, "failed");
      assert.equal(failed.state.state, "idle", "an operation failure does not change session state");
      assert.equal(listed(name).state, "idle");
      assert.equal((await render(name)).status, "completed", "extension UI stays available after a failed operation");
      const kernelBefore = listed(name).kernel?.kernelId;
      assert.ok(kernelBefore);
      assert.equal(await readFile(effects, "utf8"), "1");
      // A stale client cannot replace a live runtime merely because its preceding operation failed.
      await assert.rejects(request("recoverSession", { sessionId: name, mode: "auto" }), (rejection) => rejection.code === "BUSY");
      const calls = provider.state.callCount;
      provider.setResponses([
        fauxAssistantMessage(fauxToolCall("kernel_code", { code: `from pathlib import Path\nassert recovery_seed == 73\nassert Path(${JSON.stringify(effects)}).read_text() == '1'\nprint(91)` }), { stopReason: "toolUse" }),
        fauxAssistantMessage("NEW_INPUT_DONE"),
      ]);
      const next = await send(name, `NEW_INPUT_${created.session.sessionId}`);
      assert.equal(next.outcome.status, "completed");
      assert.equal(next.state.sessionId, created.session.sessionId);
      assert.equal(provider.state.callCount, calls + 2, "only the new input reaches the model");
      for (const marker of [`FAILED_INPUT_${created.session.sessionId}`, `NEW_INPUT_${created.session.sessionId}`]) assert.equal(userCount(next.state, marker), 1, `${marker} is kept once, never replayed`);
      assert(next.state.messages.some((message) => message.role === "assistant" && message.stopReason === "error" && message.errorMessage === "TERMINAL_PROVIDER_FIXTURE_FAILURE"), "the failed reply stays in history");
      assert.equal(listed(name).kernel.kernelId, kernelBefore, "the same kernel keeps running");
      assert(next.state.messages.some((message) => message.role === "toolResult" && message.toolName === "kernel_code" && !message.isError && JSON.stringify(message.content).includes("91")));
      console.log(`PASS ${created.session.sessionId}: provider failure fails only the operation; idle, extension UI renders, next input runs once on the same runtime`);
    }

    // Unknown outcome: the kernel dies inside a Python call. The session stays idle; the next message brings a new
    // kernel on the saved target/cwd without replaying the uncertain cell.
    const deathEffect = join(cwd, "death-effect");
    const deathPid = join(root, "dead-repl.pid");
    provider.setResponses([
      fauxAssistantMessage(fauxToolCall("kernel_code", { code: `import os\nfrom pathlib import Path\nPath(${JSON.stringify(deathEffect)}).write_text('once')\nPath(${JSON.stringify(deathPid)}).write_text(str(os.getpid()))\nos.kill(os.getpid(), 9)` }), { stopReason: "toolUse" }),
      fauxAssistantMessage("AFTER_DEATH"),
    ]);
    const deadKernel = listed(worker.session.sessionId).kernel.kernelId;
    const died = await send(worker.session.sessionId, "KERNEL_DEATH_INPUT");
    assert.equal(died.outcome.status, "unknown");
    assert.equal(died.state.state, "idle", "an unknown outcome does not change session state");
    assert.equal((await render(worker.session.sessionId)).status, "completed");
    provider.setResponses([
      fauxAssistantMessage(fauxToolCall("kernel_code", { code: "assert 'recovery_seed' not in globals()\nprint(17)" }), { stopReason: "toolUse" }),
      fauxAssistantMessage("AFTER_NEW_KERNEL"),
    ]);
    const rebuilt = await send(worker.session.sessionId, "AFTER_DEATH_INPUT");
    assert.equal(rebuilt.outcome.status, "completed");
    assert.equal(rebuilt.state.sessionId, worker.session.sessionId);
    assert.notEqual(listed(worker.session.sessionId).kernel.kernelId, deadKernel);
    await assertProcessExited(Number(await readFile(deathPid, "utf8")));
    assert.equal(await readFile(deathEffect, "utf8"), "once", "the uncertain cell is not replayed");
    assert.equal(userCount(rebuilt.state, "KERNEL_DEATH_INPUT"), 1);
    console.log("PASS unknown: kernel death leaves the session idle; the next message starts a new kernel and runs once");

    // Worker without a runtime whose environment is gone: unavailable with a reason, each message retries.
    const workerName = worker.session.sessionId;
    await request("closeSession", { sessionId: workerName });
    await rm(cwd, { recursive: true, force: true });
    const historyBefore = JSON.stringify((await request("state", { sessionId: workerName })).messages);
    const callsBeforeUnavailable = provider.state.callCount;
    for (const attempt of [1, 2]) {
      const refusal = await refused(workerName, `UNAVAILABLE_WORKER_${attempt}`);
      assert.equal(refusal.code, "UNAVAILABLE", String(refusal));
      assert.equal(refusal.details?.submitted, false);
      assert.equal(refusal.details?.stage, "kernel");
      assert.ok(refusal.details?.reason);
      const state = await request("state", { sessionId: workerName });
      assert.equal(state.state, "unavailable");
      assert.equal(listed(workerName).state, "unavailable");
      assert.equal(listed(workerName).recovery.status, "unavailable");
      assert.equal(listed(workerName).recovery.message, refusal.details.reason, "the session shows why it is unavailable");
      assert.equal(JSON.stringify(state.messages), historyBefore, "a refused message is not appended");
      assert.equal(state.kernel?.kernelId, undefined, "Failed creation retains no executable REPL binding");
    }
    assert.equal(provider.state.callCount, callsBeforeUnavailable, "a refused message never reaches the model");
    await mkdir(cwd);
    provider.setResponses([fauxAssistantMessage("WORKER_BACK")]);
    const back = await send(workerName, "AFTER_ENV_FIXED");
    assert.equal(back.outcome.status, "completed");
    assert.equal(back.state.state, "idle");
    assert.equal(listed(workerName).state, "idle");
    assert.equal(listed(workerName).recovery.status, "new");
    for (const marker of ["UNAVAILABLE_WORKER_1", "UNAVAILABLE_WORKER_2"]) assert.equal(userCount(back.state, marker), 0);
    console.log("PASS worker unavailable: missing cwd is reported with its reason, every message retries, and the fixed environment starts again");

    // Persisted model loss does not eagerly start a runtime during Gateway startup. New input retries recovery.
    const savedHistory = (await request("state", { sessionId: workerName })).messages;
    await request("closeSession", { sessionId: workerName });
    await stopOwner();
    modelRuntime.unregisterProvider(provider.provider.id);
    try {
      await startOwner();
      const dormant = await request("state", { sessionId: workerName });
      assert.equal(dormant.state, "closed", "History loads without eagerly resolving the saved model");
      assert.deepEqual(dormant.messages, savedHistory);
      const callsBefore = provider.state.callCount;
      const refusal = await refused(workerName, "MODEL_UNAVAILABLE_INPUT");
      assert.equal(refusal.code, "UNAVAILABLE");
      assert.equal(refusal.details?.submitted, false);
      assert.equal(refusal.details?.stage, "kernel");
      assert.match(refusal.details?.reason, /model .* unavailable/);
      assert.equal((await request("state", { sessionId: workerName })).state, "unavailable");
      assert.match(listed(workerName).recovery.message, /model .* unavailable/);
      assert.equal(provider.state.callCount, callsBefore);
    } finally {
      modelRuntime.registerNativeProvider(provider.provider);
      await modelRuntime.refresh({ allowNetwork: false });
    }
    provider.setResponses([fauxAssistantMessage("MODEL_BACK")]);
    const modelBack = await send(workerName, "AFTER_MODEL_RETURNS");
    assert.equal(modelBack.outcome.status, "completed");
    assert.equal(modelBack.state.state, "idle");
    assert.equal(modelBack.state.sessionId, worker.session.sessionId);
    assert.equal(userCount(modelBack.state, "MODEL_UNAVAILABLE_INPUT"), 0);
    assert.equal(listed(workerName).recovery.status, "new");
    console.log("PASS model unavailable: Gateway loads dormant history; failed new-input recovery reports the reason; restored model starts only new input");

await checkBrowserRecovery({ socket, onCleanup, sessionId: worker, workerName, provider, settled, userCount, request, cwd, stopOwner, startOwner, modelRuntime, fauxAssistantMessage });
  }, { tempParent: root });
} finally { await rm(root, { recursive: true, force: true }); }
