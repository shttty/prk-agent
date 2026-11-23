import assert from "node:assert/strict";
import { mkdtemp, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { setImmediate, setTimeout as delay } from "node:timers/promises";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../../../src/kernel/kernel-options.ts";
import { assembleKernelPlugin } from "../../../src/plugins/kernel/assemble-kernel-plugin.ts";
import { assembleAskPlugin } from "../../../src/plugins/ask/assemble-ask-plugin.ts";
import { createAskTool } from "../../../src/plugins/ask/tools/create-tool.ts";
import { createSessionHost } from "../../../src/sessions/host/assemble-host.ts";
import { createExtensionHandlerScope } from "../../../src/sessions/extension-invocation/assemble-extension-invocation.ts";
import { createHostedExtensionUI } from "../../../src/sessions/extension-ui/assemble-extension-ui.ts";
import { HOSTED_THEME_PATHS } from "../../../src/sessions/session-settings/theme-paths.ts";

export const text = (message) => typeof message?.content === "string" ? message.content : (message?.content ?? []).filter(({ type }) => type === "text").map(({ text }) => text).join("\n");
export async function until(read, label) {
  const deadline = performance.now() + 10_000;
  for (;;) {
    const value = await read();
    if (value) return value;
    assert(performance.now() < deadline, `Yielded SDK cell: ${label}`);
    await delay(10);
  }
}
export async function within(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Yielded SDK cell: ${label}`)), 10_000); })]); }
  finally { clearTimeout(timer); }
}
export function activeClock() {
  let now = 0;
  const timers = new Set();
  return {
    now: () => now,
    schedule(fn, delayMs) {
      const timer = { fn, due: now + delayMs };
      timers.add(timer);
      return () => timers.delete(timer);
    },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const timer = [...timers].filter(({ due }) => due <= end).sort((a, b) => a.due - b.due)[0];
        if (!timer) break;
        now = timer.due;
        timers.delete(timer);
        timer.fn();
        await setImmediate();
      }
      now = end;
      await setImmediate();
    },
  };
}
export async function createYieldedSdkCell({ runtime, tempRoot, onCleanup }, {
  ensure = true, sessionManager = SessionManager.inMemory(tempRoot), runnerMaxActiveCells,
  parallelAsks = false,
  maxActiveCells = DEFAULT_KERNEL_EXECUTION_POLICY.maxActiveCells,
} = {}) {
  const clock = activeClock();
  const scope = createExtensionHandlerScope();
  const owner = createPythonTool({ ...runtime, scoped: false }, {
    codeMode: true, clock, runnerMaxActiveCells,
    executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, maxActiveCells, reminderLadderMs: [1000, 3000, 6000] }),
  }, { executionTimeoutMs: 10_000 });
  onCleanup(() => owner.close());
  const agentDir = await mkdtemp(join(tempRoot, "sdk-agent-"));
  const models = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "yielded-sdk-cell", models: [{ id: "visual", input: ["text", "image"] }], tokensPerSecond: 100_000 });
  models.registerNativeProvider(provider.provider);
  const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" });
  const fixturePrompt = { helpers: [], toolLibrary: false, autoTools: false, kernelScoped: false,
    kernelCapabilities: () => false, capabilityEnabled: () => false, fileHelper: () => false, binaryPrompt: () => undefined };
  const requests = [], events = [], hooks = [], errors = [], reminders = [], gates = [];
  const kernelWakeIds = [];
  let session, ui, host, nextCall, settlementGate, currentRun, serial = 0;
  const askEnvironment = { ui: () => ui, timeoutMs: 0 };
  // Pi serializes the stock Ask definition across parents. For the host ownership proof only,
  // declare the same tool parallel via public SDK registration so both real dialogs can be live.
  const askFactory = parallelAsks
    ? (pi) => pi.registerTool({ ...createAskTool(askEnvironment), executionMode: "parallel" })
    : assembleAskPlugin(askEnvironment, { enabled: () => true, callableTools: () => ["ask"] });
  provider.setResponses(Array.from({ length: 100 }, () => (context) => {
    requests.push(structuredClone(context));
    if (!nextCall) return fauxAssistantMessage("The background cell owns its work; no polling is needed.");
    const call = nextCall;
    nextCall = undefined;
    return fauxAssistantMessage(fauxToolCall(call.name, call.args, { id: call.id }), { stopReason: "toolUse" });
  }));
  const loader = new DefaultResourceLoader({ cwd: tempRoot, agentDir, settingsManager,
    noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true,
    additionalThemePaths: HOSTED_THEME_PATHS,
    extensionsOverride: (loaded) => scope.override(loaded),
    extensionFactories: [
      { name: "kernel", factory: assembleKernelPlugin(owner.tool, { enabled: () => true, toolEnabled: () => true,
        prepareLoadout: () => ({}), afterCompaction: () => owner.afterCompaction(), callableTools: () => [],
        prompt: () => fixturePrompt, client: owner, session: () => session, runCallback: scope.runCell }) },
      { name: "ask", factory: askFactory },
      { name: "yield-observer", factory: (pi) => {
        pi.registerTool({ name: "late_probe", label: "Late probe", description: "Check a real late nested SDK result hook",
          parameters: { type: "object", properties: {} }, execute: async () => ({ content: [{ type: "text", text: "ORIGINAL" }], details: {} }) });
        pi.on("tool_call", (event, ctx) => {
          if (event.parentToolCallId) hooks.push({ phase: "call", ...event, signal: ctx.signal, afterEnd: events.some((item) => item.type === "agent_end") });
        });
        pi.on("tool_result", (event, ctx) => {
          if (!event.parentToolCallId) return;
          hooks.push({ phase: "result", ...event, signal: ctx.signal, afterEnd: events.some((item) => item.type === "agent_end") });
          if (event.toolName === "late_probe") return { content: [{ type: "text", text: "HOOK_REWRITTEN" }] };
        });
        pi.on("before_agent_start", (event) => {
          if (event.messageType === "custom" && event.message.customType === "kernel-event") {
            kernelWakeIds.push(event.message.details.eventId);
          }
        });
        pi.on("agent_settled", async () => {
          const gate = settlementGate;
          if (!gate) return;
          settlementGate = undefined;
          gate.window = { idle: session.isIdle, idleWaitPending: !currentRun.settled, calls: provider.state.callCount };
          gate.entered.resolve();
          await gate.release.promise;
        });
      } },
    ],
  });
  await loader.reload();
  ({ session } = await createAgentSession({ cwd: tempRoot, agentDir, modelRuntime: models, model: provider.getModel(), thinkingLevel: "off",
    resourceLoader: loader, settingsManager, sessionManager, noTools: "all",
    tools: ["kernel_code", "kernel_read", "kernel_interrupt", "late_probe", "ask"] }));
  ui = await createHostedExtensionUI(session, agentDir);
  await session.bindExtensions({ mode: "print", uiContext: ui.context, onError: (error) => errors.push(error) });
  host = createSessionHost({ session, kernel: owner, extensionUi: ui, extensionHandlers: scope,
    dispose: async () => { await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" }); session.dispose(); } });
  onCleanup(async () => { for (const gate of gates) gate.release.resolve(); await host.close(); });
  session.subscribe((event) => {
    events.push(event);
    if (event.type === "agent_start") {
      const run = currentRun = { settled: false };
      void session.waitForIdle().then(() => { run.settled = true; });
    }
  });
  onCleanup(owner.subscribeReminders((event) => reminders.push(event)));
  if (ensure) await owner.ensure();
  const parent = (id) => session.messages.find((message) => message.role === "toolResult" && message.toolCallId === id);
  const nativeEvents = (cellId, kind) => session.sessionManager.getEntries().filter((entry) => entry.type === "custom_message" && entry.customType === "kernel-event"
    && entry.details?.cellId === cellId && (!kind || entry.details.kind === kind));
  return {
    owner, host, session, ui, provider, clock, events, hooks, errors, requests, reminders, parent, nativeEvents, kernelWakeIds,
    path: (name) => join(tempRoot, name),
    release: (path) => writeFile(path, ""),
    exists: (path) => access(path).then(() => true, (error) => { if (error.code === "ENOENT") return false; throw error; }),
    waitCode: (path) => `while not os.path.exists(${JSON.stringify(path)}):\n time.sleep(0.005)`,
    async start(code, { settle = false, yield_s = 0, tool = "kernel_code", title, mode, inputs, outputs } = {}) {
      await until(() => host.isIdle && session.isIdle, "previous SDK operation did not settle");
      assert.equal(nextCall, undefined);
      const id = `yielded-parent-${++serial}`;
      let gate;
      if (settle) { gate = { entered: Promise.withResolvers(), release: Promise.withResolvers() }; gates.push(gate); settlementGate = gate; }
      nextCall = { id, name: tool, args: tool === "kernel_code" ? { code, yield_s, ...(title === undefined ? {} : { title }),
        ...(mode === undefined ? {} : { mode }), ...(inputs === undefined ? {} : { inputs }), ...(outputs === undefined ? {} : { outputs }) } : code };
      const submission = await host.submit({ requestId: id, message: "Run the next owned fixture cell." });
      assert(submission.accepted, submission.error);
      return { id, gate, ...submission };
    },
    async running(run) {
      const result = await until(() => parent(run.id), "parent tool did not return");
      const value = JSON.parse(text(result));
      assert.equal(value.status, "running");
      const cell = { kernelId: result.details.kernelId, cellId: value.cell_id };
      const active = owner.getSnapshot().activeCells.find(({ cellId }) => cellId === cell.cellId);
      assert.deepEqual({ kernelId: active.kernelId, cellId: active.cellId, toolCallId: active.toolCallId, startedAt: active.startedAt },
        { ...cell, toolCallId: run.id, startedAt: result.details.startedAt });
      assert.equal(typeof active.output, "string");
      assert.equal(typeof active.truncated, "boolean");
      assert.equal(typeof active.waitingForAsk, "boolean");
      assert(Number.isFinite(active.elapsedMs) && Number.isFinite(active.activeMs));
      assert(Number.isSafeInteger(active.imageCount));
      assert.deepEqual(host.getSnapshot().kernel.activeCells, owner.getSnapshot().activeCells);
      return { cell, result: structuredClone(result) };
    },
  };
}
