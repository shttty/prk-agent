import assert from "node:assert/strict";
import { once } from "node:events";
import { appendFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";
import { DEFAULT_KERNEL_OPTIONS } from "../../../src/config/kernel/kernel-options.ts";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../../../src/kernel/kernel-options.ts";

const [{ root, config, boundary, sessionId: restoredId }] = await once(process, "message");
const { agentDir } = initializePrkHome(root);
await mkdir(agentDir, { recursive: true });
const { createAgentSession, DefaultResourceLoader, ModelRuntime, SettingsManager } = await import("@earendil-works/pi-coding-agent");
const { fauxAssistantMessage, fauxProvider, fauxToolCall } = await import("@earendil-works/pi-ai");
const { createPythonTool } = await import("../../../src/kernel/assemble-kernel.ts");
const { assembleKernelPlugin } = await import("../../../src/plugins/kernel/assemble-kernel-plugin.ts");
const { createSessionHost } = await import("../../../src/sessions/host/assemble-host.ts");
const { createExtensionHandlerScope } = await import("../../../src/sessions/extension-invocation/assemble-extension-invocation.ts");
const { createTargetEnvironments } = await import("../../../src/target-environment/connection/assemble-environments.ts");
const { parseProcessWindowLimits } = await import("../../../src/target-environment/process-window/parse-limits.ts");
const { assembleGatewaySeams } = await import("./assemble-gateway-seams.mjs");
const { until, within, text } = await import("../../kernel/fixtures/create-yielded-sdk-cell.mjs");
const models = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
const provider = fauxProvider({ provider: "cell-recovery", models: [{ id: "visual", input: ["text", "image"] }], tokensPerSecond: 100_000 });
models.registerNativeProvider(provider.provider);
const environments = createTargetEnvironments({ resolve: () => ({ local: true }) });
const scope = createExtensionHandlerScope();
const owner = createPythonTool({ target: "fixture", python: config.python, cwd: root, scoped: false,
  memoryMax: DEFAULT_KERNEL_OPTIONS.memoryMax, memorySwapMax: DEFAULT_KERNEL_OPTIONS.memorySwapMax,
  processWindow: parseProcessWindowLimits(), acquire: () => {
  appendFileSync(join(root, "acquires"), "acquire\n");
  return environments.acquire("fixture");
} }, { codeMode: true, executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, reminderLadderMs: [60_000] }) }, { executionTimeoutMs: 0 });
const errors = [];
let session, host, nextCall, capturedRun, serial = 0;
const gate = { entered: Promise.withResolvers(), release: Promise.withResolvers(), held: !restoredId && boundary !== "open" };
provider.setResponses(Array.from({ length: 100 }, () => () => {
  appendFileSync(join(root, "provider-calls"), "call\n");
  if (!nextCall) return fauxAssistantMessage("The owned background cell needs no polling.");
  const call = nextCall;
  nextCall = undefined;
  appendFileSync(join(root, "tool-submissions"), `${call.name}\n`);
  return fauxAssistantMessage(fauxToolCall(call.name, call.args, { id: call.id }), { stopReason: "toolUse" });
}));
const prompt = { helpers: [], toolLibrary: false, autoTools: false, kernelScoped: false, kernelCapabilities: () => false,
  capabilityEnabled: () => false, fileHelper: () => false, binaryPrompt: () => undefined };
const ctx = await assembleGatewaySeams(root, config, async (_target, { sessionManager }) => {
  const settingsManager = SettingsManager.inMemory({ cacheWarming: "off", compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" });
  const loader = new DefaultResourceLoader({ cwd: root, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noContextFiles: true, noPromptTemplates: true, noThemes: true, extensionsOverride: (loaded) => scope.override(loaded), extensionFactories: [
      { name: "kernel", factory: assembleKernelPlugin(owner.tool, { enabled: () => true, toolEnabled: () => true,
        prepareLoadout: () => ({}), afterCompaction: () => owner.afterCompaction(), callableTools: () => [],
        prompt: () => prompt, client: owner, session: () => session, runCallback: scope.runCell }) },
      { name: "crash-boundary", factory: (pi) => { pi.on("agent_settled", async () => {
        if (!gate.held) return;
        gate.held = false;
        gate.proof = { sdkIdle: session.isIdle, settlementPending: !capturedRun.settled, calls: provider.state.callCount };
        gate.entered.resolve();
        await gate.release.promise;
      }); } },
    ] });
  await loader.reload();
  ({ session } = await createAgentSession({ cwd: root, agentDir, modelRuntime: models, model: provider.getModel(), thinkingLevel: "off",
    resourceLoader: loader, settingsManager, sessionManager, noTools: "all", tools: ["kernel_code", "kernel_read", "kernel_interrupt"] }));
  session.subscribe((event) => {
    if (event.type !== "agent_start") return;
    const run = capturedRun = { settled: false };
    void session.waitForIdle().then(() => { run.settled = true; });
  });
  await session.bindExtensions({ mode: "print", onError: (error) => errors.push(error) });
  host = createSessionHost({ session, kernel: owner, extensionHandlers: scope, dispose: async () => {
    await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
    session.dispose();
  } });
  return { session, host, kernel: owner, toolMode: "direct", delegation: "restrained", localTools: false, requiresReload: false, terminalActive: false,
    close: async () => { await owner.prepareHandoff(); await host.close(); await owner.close(); } };
});
const manager = restoredId ? ctx.host.history.get(restoredId).manager : ctx.host.history.create("fixture", "Owned crash recovery", root);
const sessionId = manager.getSessionId();
await ctx.host.collection.create("fixture", manager, {}); // No ensure: restored reads must not create a REPL.
ctx.methods.sessionHost(sessionId);
const entries = (type) => manager.getBranch().filter((entry) => entry.customType === type);
const parent = (id) => session.messages.find((message) => message.role === "toolResult" && message.toolCallId === id);
async function submit(name, args) {
  const id = `crash-fixture-${restoredId ? "restored" : "initial"}-${++serial}`;
  nextCall = { id, name, args };
  const run = await host.submit({ requestId: id, message: "Run the next owned fixture request." });
  assert(run.accepted, run.error);
  const result = await until(() => parent(id), "native tool result missing");
  return { run, result };
}
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==";
const finishPath = join(root, "finish");
let cellId;
async function command(method, args) {
  if (method === "run") {
    const code = `import os, time\nfrom pathlib import Path\nwith open(${JSON.stringify(join(root, "executions"))}, 'a') as f: f.write('execute\\n')\nPath(${JSON.stringify(join(root, "kernel-pid"))}).write_text(str(os.getpid()))\nprint('BEFORE_CRASH', flush=True)\nwhile not Path(${JSON.stringify(finishPath)}).exists():\n time.sleep(0.005)\nprint('SAVED_FINAL')\ndisplay({'image/png':${JSON.stringify(png)}}, raw=True)`;
    const { run, result } = await submit("kernel_code", { code, yield_s: 0 });
    assert(!result.isError, text(result));
    const running = JSON.parse(text(result));
    assert.equal(running.status, "running");
    cellId = running.cell_id;
    await until(async () => readFile(join(root, "kernel-pid"), "utf8").catch((error) => { if (error.code !== "ENOENT") throw error; }), "Python side effect missing");
    assert.equal(entries("kernel-cell-open").length, 1);
    if (boundary === "open") {
      assert.equal((await within(run.completion, "initial operation did not settle")).status, "completed");
      assert(host.isIdle && session.isIdle);
    } else {
      await within(gate.entered.promise, "public settlement gate missing");
      assert.deepEqual(gate.proof, { sdkIdle: true, settlementPending: true, calls: provider.state.callCount });
    }
    return { cellId, kernelId: result.details.kernelId, toolCallId: result.toolCallId, startedAt: result.details.startedAt,
      pid: Number(await readFile(join(root, "kernel-pid"), "utf8")), gate: gate.proof };
  }
  if (method === "finish") {
    const calls = provider.state.callCount;
    await writeFile(finishPath, "");
    await until(() => entries("kernel-cell-result").length === 1, "durable final result missing");
    assert.equal(entries("kernel-event").length, 0, "wake was submitted while public settlement gate was held");
    assert.equal(provider.state.callCount, calls);
    if (boundary === "native") {
      gate.release.resolve();
      await until(() => entries("kernel-event").filter(({ details }) => details.kind === "finished").length === 1 && host.isIdle && session.isIdle,
        "native durable custom_message missing");
    }
    return { opens: entries("kernel-cell-open").length, results: entries("kernel-cell-result").length, finished: entries("kernel-event").length };
  }
  if (method === "read") {
    const { run, result } = await submit("kernel_read", args);
    assert.equal((await within(run.completion, "read operation did not settle")).status, "completed");
    return result;
  }
  if (method === "project") return { snapshot: ctx.methods.archivedSnapshot(ctx.host.history.get(sessionId)),
    view: ctx.methods.kernelResult(sessionId, args.cellId, args.imageIndex) };
  if (method === "reclaim") {
    const binding = ctx.sessionHosts.hostBindings.get(sessionId);
    binding.idleSince = 0;
    await ctx.methods.reclaimIdle();
    return { sleeping: ctx.host.history.get(sessionId).sleeping === true, runtimePresent: !!ctx.host.collection.get(sessionId),
      active: owner.hasInFlightCell(), hostIdle: host.isIdle, sdkIdle: session.isIdle };
  }
  if (method === "stop") {
    gate.release.resolve();
    await ctx.host.collection.close();
    for (const binding of ctx.sessionHosts.hostBindings.values()) binding.dispose();
    ctx.monitoring.unsubscribeMonitor();
    await ctx.monitoring.monitor.close();
    assert.deepEqual(errors, [], "SDK extension errors must remain visible");
    return { stopped: true };
  }
  throw new Error(`Unknown fixture command: ${method}`);
}
let pending = Promise.resolve();
process.on("message", ({ id, method, args }) => {
  pending = pending.then(async () => {
    try { process.send({ id, data: await command(method, args) }, () => { if (method === "stop") process.disconnect(); }); }
    catch (error) { process.send({ id, error: error.stack }); }
  });
});
process.send({ type: "ready", sessionId, sessionFile: manager.getSessionFile() });
