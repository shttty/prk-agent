import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createExtensionHandlerScope } from "../../src/sessions/extension-invocation/assemble-extension-invocation.ts";
import { createSessionHost } from "../../src/sessions/host/assemble-host.ts";

async function within(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} did not settle within one second`)), 1_000);
    })]);
  } finally { clearTimeout(timer); }
}

const cwd = await mkdtemp(join(tmpdir(), "prk-local-hook-abort-"));
const agentDir = join(cwd, "agent");
const scope = createExtensionHandlerScope();
const rejected = [];
const unhandled = [];
const onUnhandled = (error) => unhandled.push(error);
process.on("unhandledRejection", onUnhandled);
let host;
try {
  const path = join(cwd, "path-plugin.mjs");
  await writeFile(path, `export default (pi) => {
    pi.on("tool_call", async (event, ctx) => {
      if (event.input.kind !== "path") return;
      ctx.signal.addEventListener("abort", () => ctx.ui.notify("path-aborted", "info"), { once: true });
      ctx.ui.notify("path-entered", "info");
      return await new Promise(() => {});
    });
  };`);
  let entered = Promise.withResolvers();
  let abortObserved = false;
  let original;
  let unregister;
  let dynamicCalls = 0;
  let shutdownCalls = 0;
  let hangShutdown = false;
  let executions = 0;
  let missingSdkSignal = false;
  const hang = (ctx) => {
    assert(ctx.signal instanceof AbortSignal);
    ctx.signal.addEventListener("abort", () => { abortObserved = true; }, { once: true });
    entered.resolve();
    return new Promise((_resolve, reject) => rejected.push(reject));
  };
  const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    additionalExtensionPaths: [path],
    extensionFactories: [{ name: "local-factory", factory: (pi) => {
      pi.on("session_start", () => {
        unregister = pi.on("tool_call", () => { dynamicCalls += 1; });
      });
      pi.on("input", async (event, ctx) => {
        if (event.text === "input-hang") return await hang(ctx);
      });
      pi.on("tool_call", async (event, ctx) => {
        if (event.input.kind === "factory") return await hang(ctx);
      });
      pi.on("tool_result", async (event, ctx) => {
        if (event.input.kind === "result") return await hang(ctx);
      });
      pi.on("session_shutdown", async (_event, ctx) => {
        shutdownCalls += 1;
        if (hangShutdown) return await hang(ctx);
      });
    } }],
    extensionsOverride: (base) => scope.override(base, (loaded) => {
      original = loaded.extensions;
      return loaded;
    }),
  });
  await loader.reload();
  const projections = loader.getExtensions().extensions;
  for (const [index, extension] of projections.entries()) {
    assert.notEqual(extension, original[index], "the public loader hook returns project-owned extension projections");
    assert.notEqual(extension.handlers, original[index].handlers, "the SDK handler map is never replaced or edited");
  }
  const modelRuntime = await ModelRuntime.create({ authPath: join(cwd, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const provider = fauxProvider({ tokensPerSecond: 10_000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const { session } = await createAgentSession({
    cwd, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off",
    settingsManager, resourceLoader: loader, sessionManager: SessionManager.inMemory(cwd),
    noTools: "all", tools: ["local_probe"],
    customTools: [{
      name: "local_probe", label: "Local probe", description: "Return a deterministic fixture result",
      parameters: { type: "object", properties: { kind: { type: "string" } }, required: ["kind"] },
      async execute() { executions += 1; return { content: [{ type: "text", text: "ORIGINAL_RESULT" }], details: { original: true } }; },
    }],
  });
  host = createSessionHost({ session, extensionHandlers: scope, dispose: async () => {
    await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
    session.dispose();
  } });
  const errors = [];
  await session.bindExtensions({
    mode: "print",
    uiContext: { ...session.extensionRunner.getUIContext(), notify(message) {
      if (message === "path-entered") entered.resolve();
      if (message === "path-aborted") abortObserved = true;
    } },
    onError: (error) => errors.push(error),
  });
  // The public SDK context really has no active signal before the input starts an agent run.
  missingSdkSignal = session.extensionRunner.createContext().signal === undefined;
  assert(missingSdkSignal);
  for (const kind of ["path", "factory", "result", "input"]) {
    entered = Promise.withResolvers();
    abortObserved = false;
    const beforeExecutions = executions;
    const toolCallId = `local-${kind}`;
    provider.setResponses(kind === "input" ? [fauxAssistantMessage("must not run after input cancellation")]
      : [fauxAssistantMessage(fauxToolCall("local_probe", { kind }, { id: toolCallId }), { stopReason: "toolUse" }), fauxAssistantMessage("must not continue after cancellation")]);
    const submission = await host.submit({ requestId: kind, message: kind === "input" ? "input-hang" : `Exercise ${kind}` });
    assert.equal(submission.accepted, true);
    await within(entered.promise, `${kind} hook entry`);
    await host.cancel({ operationId: submission.operationId });
    assert.equal((await within(submission.completion, `${kind} cancellation`)).status, "cancelled");
    assert(abortObserved, "the handler/transport abort listener runs before the race releases the operation");
    assert.equal(executions - beforeExecutions, kind === "result" ? 1 : 0, "tool_call cancellation must block tool execution");
    if (kind === "result") {
      const result = session.messages.findLast((message) => message.role === "toolResult" && message.toolCallId === toolCallId);
      assert(result, "Pi retains the real tool result after a tool_result handler throws on abort");
      assert.equal(result.content[0].text, "ORIGINAL_RESULT");
    }
    provider.setResponses([fauxAssistantMessage("next operation is usable")]);
    const next = await host.submit({ requestId: `${kind}-next`, message: "Continue normally" });
    assert.equal((await within(next.completion, `${kind} next operation`)).status, "completed");
  }
  assert(errors.some((error) => error.event === "tool_result"), "Pi, not the wrapper, reports tool_result handler errors");
  const sourceFactory = original.find((extension) => extension.path === "<inline:local-factory>");
  const factoryProjection = projections.find((extension) => extension.path === "<inline:local-factory>");
  assert.equal(factoryProjection.handlers.get("tool_call").length, sourceFactory.handlers.get("tool_call").length);
  const beforeUnregister = factoryProjection.handlers.get("tool_call").length;
  unregister();
  assert.equal(factoryProjection.handlers.get("tool_call").length, beforeUnregister - 1, "runtime unsubscribe stays authoritative after projection");
  assert(dynamicCalls > 0, "handlers registered at session_start must participate in later dispatch");
  hangShutdown = true;
  entered = Promise.withResolvers();
  const reload = host.reload();
  await within(entered.promise, "reload shutdown entry");
  scope.cancel();
  await within(reload, "reload with a hanging shutdown handler");
  entered = Promise.withResolvers();
  const close = host.close();
  await within(entered.promise, "close shutdown entry");
  scope.cancel();
  await within(close, "close with a hanging shutdown handler");
  assert.equal(shutdownCalls, 2, "cancelled shutdown hooks still start their cooperative cleanup");
  for (const reject of rejected) reject(new Error("late ignored plugin rejection"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(unhandled, [], "Promise.race must consume late handler rejection");
  console.log("PASS: public loader path/factory projections, missing-signal owner cancellation, Pi hook throw semantics, next operation, dynamic registration, reload/close, and late rejection");
} finally {
  scope.close();
  await host?.close();
  process.removeListener("unhandledRejection", onUnhandled);
  await rm(cwd, { recursive: true, force: true });
}
