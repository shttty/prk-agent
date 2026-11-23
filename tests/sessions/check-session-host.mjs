import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAgentSession,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { bindHostedExtensions } from "../../src/sessions/host/bind-extensions.ts";
import { createSessionHost } from "../../src/sessions/host/assemble-host.ts";
import { createHostedExtensionUI } from "../../src/sessions/extension-ui/assemble-extension-ui.ts";
import { HOSTED_THEME_PATHS } from "../../src/sessions/session-settings/theme-paths.ts";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function makeDisposableSession() {
  const listeners = new Set();
  return {
    sessionId: "cleanup-session",
    isStreaming: false,
    isIdle: true,
    isCompacting: false,
    pendingMessageCount: 0,
    messages: [],
    emit(event) { for (const listener of listeners) listener(event); },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async prompt() { },
    async steer() { },
    async followUp() { },
    async abort() { },
    async waitForIdle() { },
    getSteeringMessages() { return []; },
    getFollowUpMessages() { return []; },
    clearQueue() {
      return { steering: [], followUp: [] };
    },
    async reload() { },
    disposeCount: 0,
    dispose() {
      this.disposeCount += 1;
    },
  };
}


async function createControlledSession(input, customTools = [], extensionFactories = []) {
  const cwd = await mkdtemp(join(tmpdir(), "pi-session-host-")).then((path) => path);
  const agentDir = join(cwd, "agent");
  const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: "You are a deterministic host smoke provider.",
    extensionFactories: [...(input ? [{ name: "controlled-input", factory: (pi) => { pi.on("input", input); } }] : []), ...extensionFactories],
  });
  await resourceLoader.reload();
  const modelRuntime = await ModelRuntime.create({ authPath: join(cwd, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const faux = fauxProvider({ tokensPerSecond: 100 });
  modelRuntime.registerNativeProvider(faux.provider);
  faux.setResponses([
    async () => {
      await sleep(100);
      return fauxAssistantMessage("first result");
    },
    fauxAssistantMessage("queued result"),
    async () => {
      await sleep(100);
      return fauxAssistantMessage("detached result");
    },
    async () => {
      await sleep(500);
      return fauxAssistantMessage("cancelled result");
    },
    fauxAssistantMessage("after cancel"),
  ]);
  const result = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime,
    model: faux.getModel(),
    thinkingLevel: "off",
    resourceLoader,
    settingsManager,
    sessionManager: SessionManager.inMemory(cwd),
    noTools: "all",
    tools: customTools.map((tool) => tool.name),
    customTools,
  });
  return { session: result.session, faux, cwd };
}

async function runControlledSmoke() {
  const { session, cwd } = await createControlledSession();
  const host = createSessionHost({ session });
  try {
  const handoff = host.subscribe(() => {});
  assert.equal(handoff.snapshot.sessionId, session.sessionId);

  const first = await host.submit({ requestId: "request-first", message: "first" });
  assert.equal(first.accepted, true);
  const second = await host.submit({
    requestId: "request-queued",
    message: "queued",
    queue: "followUp",
  });
  assert.equal(second.accepted, true);
  assert.equal(second.operationId, first.operationId);

  const completed = await first.completion;
  assert.equal(completed.status, "completed");
  assert.equal(await second.completion, completed);
  const assistantText = session.messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => message.content.filter((part) => part.type === "text").map((part) => part.text))
    .join("\n");
  assert.match(assistantText, /first result/);
  assert.match(assistantText, /queued result/);

  const detachedEvents = [];
  const detachedSubscription = host.subscribe((event) => detachedEvents.push(event));
  detachedSubscription.unsubscribe();
  const detached = await host.submit({ requestId: "request-detached", message: "detached" });
  assert.equal((await detached.completion).status, "completed");
  assert.equal(detachedEvents.length, 0, "unsubscribe must not cancel or receive later events");

  const active = await host.submit({ requestId: "request-cancel", message: "cancel" });
  assert.equal(active.accepted, true);
  const queued = await host.submit({
    requestId: "request-cancel-queued",
    message: "cancel queued",
    queue: "steer",
  });
  assert.equal(queued.accepted, true);
  const cancel = await host.cancel({ operationId: active.operationId });
  assert.equal(cancel.status, "requested");

  const cancelled = await active.completion;
  assert(["cancelled", "unknown"].includes(cancelled.status));
  const afterCancel = await host.submit({ requestId: "request-after-cancel", message: "after cancel" });
  assert.equal(afterCancel.accepted, true);
  assert.equal((await afterCancel.completion).status, "completed");

  await host.reload();
  await host.close();
  assert.equal(host.getSnapshot().state, "closed");
    console.log("PASS: actual SDK session identity, SDK queue acceptance/drain correlation, unsubscribe versus cancel, no-gap handoff, reload, and explicit closure");
  } finally {
    try {
      await host.close();
    } catch {
      // Preserve the primary assertion failure while still attempting cleanup.
    }
    session.dispose();
    await rm(cwd, { recursive: true, force: true });
  }
}

async function runReloadFailure() {
  const session = makeDisposableSession();
  session.reload = async () => { throw new Error("controlled reload failure"); };
  session.prompt = async () => { session.messages.push({ role: "assistant", stopReason: "stop", content: [{ type: "text", text: "after reload failure" }] }); };
  const host = createSessionHost({ session });
  try {
    await assert.rejects(host.reload(), /controlled reload failure/);
    assert.equal(host.getSnapshot().state, "idle", "a reload error is reported without changing session state");
    assert.equal(host.isIdle, true);
    const next = await host.submit({ requestId: "after-reload-failure", message: "next" });
    assert.equal((await next.completion).status, "completed");
  } finally { await host.close(); }
  console.log("PASS: reload failure is reported to the caller; the session stays idle and accepts input");
}


async function runDirectKernelUnknown() {
  const directSession = makeDisposableSession();
  const listeners = new Set();
  let kernelState = { state: "not_started" };
  const kernel = {
    getSnapshot: () => kernelState,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const observe = (snapshot) => { kernelState = snapshot; for (const listener of listeners) listener(snapshot); };
  directSession.prompt = async (input) => {
    if (input === "model-only") return;
    directSession.emit({ type: "tool_execution_start", toolName: "kernel_code", toolCallId: input, args: { code: "pass" } });
    observe({ state: "busy" });
    observe(input === "unknown" ? { state: "unavailable", lastOutcome: "unknown" } : { state: "idle", lastOutcome: "error" });
    directSession.emit({ type: "tool_execution_end", toolName: "kernel_code", toolCallId: input, isError: true, result: { content: [{ type: "text", text: "ValueError: outcome unknown" }] } });
    directSession.messages.push({ role: "assistant", stopReason: "stop", content: [{ type: "text", text: "model recovery text" }] });
  };
  const direct = createSessionHost({ session: directSession, kernel });
  try {
    for (const [input, expected] of [["unknown", "unknown"], ["model-only", "completed"], ["known-error", "completed"]]) {
      const submission = await direct.submit({ requestId: input, message: input });
      assert.equal((await submission.completion).status, expected, "terminal kernel outcomes are operation-local, not parsed from user-controlled error text");
      assert.equal(direct.getSnapshot().state, "idle");
    }
  } finally { await direct.close(); }
  const closeSession = makeDisposableSession();
  const closingHost = createSessionHost({ session: closeSession });
  let entered = false;
  let reentrant;
  closingHost.subscribe((event) => {
    if (!entered && event.type === "state_changed" && event.details.state === "closing") {
      entered = true;
      reentrant = closingHost.close();
    }
  });
  const close = closingHost.close();
  assert.strictEqual(reentrant, close, "close observers receive the same shared host close promise");
  await close;
  assert.equal(closeSession.disposeCount, 1);
  console.log("PASS: direct host/kernel operation-local typed Python unknown; recovery text and stale outcomes cannot mask/change disposition");
}

async function runDequeueTransitions() {
  const { session, faux, cwd } = await createControlledSession();
  const firstGate = Promise.withResolvers();
  const currentGate = Promise.withResolvers();
  const currentEntered = Promise.withResolvers();
  faux.setResponses([
    async () => { await firstGate.promise; return fauxAssistantMessage("initial completed"); },
    async () => { currentEntered.resolve(); await currentGate.promise; return fauxAssistantMessage("current completed"); },
  ]);
  const host = createSessionHost({ session });
  const enqueue = (id) => host.submit({ requestId: id, message: id, queue: "followUp" });
  try {
    const initial = await host.submit({ requestId: "initial", message: "initial" });
    await enqueue("current");
    firstGate.resolve();
    await currentEntered.promise;
    await enqueue("removed-first");
    const first = host.dequeue();
    assert.equal(first.status, "dequeued");
    assert.equal(first.text, "removed-first");
    currentGate.resolve();
    const outcome = await initial.completion;
    assert.equal(outcome.status, "unknown", "dequeued queued input leaves operation-level outcome unknown");
    const users = session.messages.filter((message) => message.role === "user").map((message) => JSON.stringify(message.content)).join("\n");
    assert.match(users, /initial/);
    assert.match(users, /current/);
    assert.doesNotMatch(users, /removed-first/);
    console.log("PASS: public SDK dequeue text and operation-level unknown outcome without queue identity inference");
  } finally {
    firstGate.resolve();
    currentGate.resolve();
    await host.close();
    await rm(cwd, { recursive: true, force: true });
  }
}

async function runStartingRun() {
  for (const messageType of ["user", "custom"]) {
    const entered = Promise.withResolvers();
    const release = Promise.withResolvers();
    let startEvent, startIdle;
    const { session, faux, cwd } = await createControlledSession(undefined, [], [{
      name: "starting-run", factory: (pi) => {
        pi.registerCommand("custom-run", { description: "Start an extension-owned custom run", handler: () => {
          pi.sendMessage({ customType: "pending-next", content: "NEXT_TURN_MARKER", display: false }, { deliverAs: "nextTurn" });
          pi.sendMessage({ customType: "start-custom", content: "CUSTOM_START_MARKER", display: true }, { triggerTurn: true });
        } });
        pi.on("before_agent_start", async (event, ctx) => {
          startEvent = event;
          startIdle = ctx.isIdle();
          pi.sendMessage({ customType: "startup-queued", content: "STARTUP_QUEUED_MARKER", display: false }, { triggerTurn: true });
          entered.resolve();
          await release.promise;
          return { message: { customType: "startup-returned", content: "STARTUP_RETURNED_MARKER", display: false } };
        });
      },
    }]);
    await session.bindExtensions({ mode: "rpc" });
    const host = createSessionHost({ session });
    try {
      faux.setResponses(Array.from({ length: 4 }, () => fauxAssistantMessage("STARTUP_REPLY")));
      const submitted = await host.submit({ requestId: `startup-${messageType}`, message: messageType === "user" ? "USER_START_MARKER" : "/custom-run" });
      await Promise.race([entered.promise, submitted.completion.then(() => { throw new Error(`before_agent_start did not fire for ${messageType}`); })]);
      assert.equal(startEvent.messageType, messageType);
      assert.equal(startIdle, false, "before_agent_start owns a busy SDK run");
      assert.equal(session.isIdle, false);
      assert.equal(host.getSnapshot().state, "running");
      if (messageType === "user") assert.equal(startEvent.prompt, "USER_START_MARKER");
      else { assert.equal("prompt" in startEvent, false); assert.equal(startEvent.message.customType, "start-custom"); }
      await assert.rejects(session.sendUserMessage("REJECTED_STARTUP_INPUT"), Error);
      await session.sendUserMessage("STARTUP_FOLLOW_UP", { deliverAs: "followUp" });
      release.resolve();
      assert.equal((await submitted.completion).status, "completed");
      assert.equal(host.getSnapshot().state, "idle");
      const users = session.messages.filter((message) => message.role === "user").map((message) => JSON.stringify(message.content));
      assert.equal(users.filter((text) => text.includes("STARTUP_FOLLOW_UP")).length, 1);
      assert(!users.some((text) => /CUSTOM_START_MARKER|REJECTED_STARTUP_INPUT/.test(text)));
      for (const customType of ["startup-queued", "startup-returned", ...(messageType === "custom" ? ["start-custom", "pending-next"] : [])]) {
        assert.equal(session.messages.filter((message) => message.role === "custom" && message.customType === customType).length, 1);
      }
      console.log(`PASS ${messageType} startup: busy host, discriminated before_agent_start, queued custom/follow-up and returned message delivered once, no fabricated user prompt`);
    } finally {
      release.resolve();
      await host.close();
      await rm(cwd, { recursive: true, force: true });
    }
  }
}

async function runAutomaticRetry() {
  const toolEntered = Promise.withResolvers();
  const releaseTool = Promise.withResolvers();
  const { session, faux, cwd } = await createControlledSession(undefined, [{
    name: "retry_probe", label: "Retry probe", description: "Return isolated fixture data",
    parameters: { type: "object", properties: {} },
    async execute() {
      toolEntered.resolve();
      await releaseTool.promise;
      return { content: [{ type: "text", text: "RETRY_TOOL_RESULT" }], details: {} };
    },
  }]);
  session.settingsManager.applyOverrides({ retry: { enabled: true, maxRetries: 1, baseDelayMs: 1 } });
  const host = createSessionHost({ session });
  const trace = [];
  session.subscribe((event) => {
    if (event.type === "message_end") trace.push(`${event.type}:${event.message.role}:${event.message.stopReason ?? event.message.toolName ?? ""}`);
    else if (event.type === "agent_end") trace.push(`agent_end:willRetry=${event.willRetry}`);
    else if (event.type === "auto_retry_end") trace.push(`auto_retry_end:success=${event.success}`);
    else if (["auto_retry_start", "tool_execution_start", "tool_execution_end", "agent_settled"].includes(event.type)) trace.push(event.type);
  });
  try {
    faux.setResponses([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error" }),
      fauxAssistantMessage(fauxToolCall("retry_probe", {}), { stopReason: "toolUse" }),
      fauxAssistantMessage("RETRY_FINAL_SUCCESS"),
    ]);
    const submission = await host.submit({ requestId: "retry-success", message: "Isolated retry probe" });
    assert.equal(submission.accepted, true);
    await Promise.race([toolEntered.promise, submission.completion.then(() => { throw new Error(`Retry tool was not executed: ${trace.join(" -> ")}`); })]);
    assert.equal(host.getSnapshot().state, "running", "SDK retry/tool continuation is not a terminal operation");
    assert.equal(host.getSnapshot().operation.operationId, submission.operationId);
    releaseTool.resolve();
    const outcome = await submission.completion;
    console.log(`SDK RETRY TRACE ${trace.join(" -> ")}`);
    assert.equal(session.messages.at(-1).stopReason, "stop", "real SDK recovered to a final assistant response");
    assert.equal(outcome.status, "completed", "successful native retry must not retain its intermediate WebSocket error");
    assert.equal(outcome.error, undefined);
    assert.equal(host.getSnapshot().state, "idle");
    assert(session.messages.some((message) => message.role === "toolResult" && message.toolName === "retry_probe" && !message.isError));
    console.log("PASS: native error -> retry -> tool -> final success settles completed/idle");
    for (const [requestId, responses, expectedError] of [
      ["retry-exhausted", [
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error: first attempt" }),
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error: exhausted" }),
      ], "WebSocket error: exhausted"],
      ["retry-then-final-error", [
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error" }),
        fauxAssistantMessage(fauxToolCall("retry_probe", {}), { stopReason: "toolUse" }),
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "Final non-retryable failure" }),
      ], "Final non-retryable failure"],
    ]) {
      trace.length = 0;
      faux.setResponses(responses);
      const failed = await host.submit({ requestId, message: requestId });
      const failure = await failed.completion;
      assert.equal(failure.status, "failed");
      assert.match(failure.error, new RegExp(expectedError));
      assert.equal(host.getSnapshot().state, "idle", "a failed operation leaves the session idle");
      console.log(`SDK FAILURE TRACE ${requestId}: ${trace.join(" -> ")}; status=${failure.status}; error=${failure.error}`);
    }
    faux.setResponses([fauxAssistantMessage("AFTER_FAILURE_DONE")]);
    const after = await host.submit({ requestId: "after-failure", message: "after-failure" });
    assert.equal((await after.completion).status, "completed", "the next input runs directly after a failed operation");
    const users = session.messages.filter((message) => message.role === "user").map((message) => JSON.stringify(message.content));
    for (const marker of ["retry-exhausted", "retry-then-final-error", "after-failure"]) assert.equal(users.filter((text) => text.includes(marker)).length, 1, `${marker} is not replayed`);

    const { session: concurrentSession, faux: concurrentProvider, cwd: concurrentCwd } = await createControlledSession(undefined, [], [{
      name: "queue-command", factory: (pi) => pi.registerCommand("reject-queue", {
        description: "A command cannot enter the SDK follow-up queue",
        handler: () => { throw new Error("Queued fixture command must not execute"); },
      }),
    }]);
    await concurrentSession.bindExtensions({ mode: "rpc" });
    concurrentSession.settingsManager.applyOverrides({ retry: { enabled: true, maxRetries: 1, baseDelayMs: 1 } });
    const concurrentHost = createSessionHost({ session: concurrentSession });
    const providerEntered = Promise.withResolvers();
    const releaseProvider = Promise.withResolvers();
    try {
      concurrentProvider.setResponses([
        async () => { providerEntered.resolve(); await releaseProvider.promise; return fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error" }); },
        fauxAssistantMessage("RECOVERED_WITH_PREFLIGHT_FAILURE"),
      ]);
      const initial = await concurrentHost.submit({ requestId: "concurrent-retry", message: "retry" });
      await providerEntered.promise;
      const rejected = await concurrentHost.submit({ requestId: "reject-queue", message: "/reject-queue", queue: "followUp" });
      releaseProvider.resolve();
      assert.equal((await initial.completion).status, "failed", "successful retry cannot clear a separate SDK invocation exception");
      assert.match((await rejected.completion).error, /cannot be queued/);
      assert.equal(concurrentSession.messages.at(-1).stopReason, "stop");
    } finally {
      releaseProvider.resolve();
      await concurrentHost.close();
      await rm(concurrentCwd, { recursive: true, force: true });
    }

    const retryStarted = Promise.withResolvers();
    const unsubscribe = session.subscribe((event) => { if (event.type === "auto_retry_start") retryStarted.resolve(); });
    session.settingsManager.applyOverrides({ retry: { baseDelayMs: 60000 } });
    try {
      faux.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "WebSocket error" })]);
      const cancelled = await host.submit({ requestId: "cancel-retry", message: "Cancel retry backoff" });
      await retryStarted.promise;
      await host.cancel({ operationId: cancelled.operationId });
      assert.equal((await cancelled.completion).status, "cancelled", "SDK-aborted retry without tool side effects remains cancelled");
      assert.equal(host.getSnapshot().state, "idle");
    } finally { unsubscribe(); }
    console.log("PASS: retry exhaustion/final error stay failed on the operation, session idle, next input runs once; successful retry retains independent invocation exception; retry cancellation remains cancelled");
  } finally {
    releaseTool.resolve();
    await host.close();
    await rm(cwd, { recursive: true, force: true });
  }
}

async function runSdkRaces() {
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  const { session, faux, cwd } = await createControlledSession(async (event) => {
    if (event.text === "handled") return { action: "handled" };
    if (event.text === "empty") return { action: "transform", text: "" };
    return { action: "continue" };
  });
  await session.bindExtensions({ mode: "rpc" });
  const host = createSessionHost({ session });
  try {
    faux.setResponses([fauxAssistantMessage("failed", { stopReason: "error", errorMessage: "controlled provider failure" })]);
    const failure = await host.submit({ requestId: "sdk-failure", message: "fail" });
    assert.equal((await failure.completion).status, "failed");
    const handled = await host.submit({ requestId: "handled", message: "handled" });
    assert.equal((await handled.completion).status, "completed", "previous assistant error must not contaminate handled input");
    for (const queue of ["steer", "followUp"]) {
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      faux.setResponses([async () => { await held; return fauxAssistantMessage("held turn finished"); }]);
      await host.submit({ requestId: `handled-${queue}-primary`, message: "primary" });
      const queued = await host.submit({ requestId: `handled-${queue}`, message: "handled", queue });
      release();
      assert.equal((await queued.completion).status, "completed");
      assert(!session.messages.some((message) => message.role === "user" && JSON.stringify(message.content).includes("handled")), "handled input must not become model-visible user input");
    }
    faux.setResponses([async () => { await sleep(80); return fauxAssistantMessage("before empty"); }, fauxAssistantMessage("empty queue")]);
    const initial = await host.submit({ requestId: "empty-primary", message: "primary" });
    const empty = await host.submit({ requestId: "empty-queued", message: "empty", queue: "followUp" });
    assert.equal(empty.accepted, true);
    await Promise.race([initial.completion, sleep(2_000).then(() => { throw new Error("SDK completion did not settle"); })]);
    assert.equal(host.getSnapshot().operation, undefined);
    assert(unhandled.length === 0);
    console.log("PASS: public SDK invocation correlation, operation-local errors, handled input, and terminal queue outcomes");
  } finally {
    await host.close();
    process.removeListener("unhandledRejection", onUnhandled);
    await rm(cwd, { recursive: true, force: true });
  }
}

async function runCorrelationReentrancy() {
  const host = createSessionHost({ session: makeDisposableSession() });
  const events = [];
  try {
    assert.equal(typeof host.getSnapshot().streamId, "string");
    assert(host.getSnapshot().streamId.length > 0);
    host.subscribe((event) => { if (event.type === "request_rejected") void host.close(); });
    const handoff = host.subscribe((event) => events.push(event));
    await host.submit({ requestId: "bad", message: "" });
    await host.close();
    assert(events.every((event, index) => event.sequence > (index ? events[index - 1].sequence : handoff.snapshot.sequence)));
    assert(events.every((event) => event.streamId === handoff.snapshot.streamId), "all host counters belong to its stream lifetime");
    const replacement = createSessionHost({ session: makeDisposableSession() });
    try {
      const next = replacement.getSnapshot();
      assert.equal(next.sessionId, handoff.snapshot.sessionId);
      assert.notEqual(next.streamId, handoff.snapshot.streamId, "rebuilding a host changes counter ownership even when the SDK conversation is unchanged");
      assert.equal(next.streamId.split(":")[0], handoff.snapshot.streamId.split(":")[0], "host identities share their process boot prefix");
      assert.equal(next.sequence, 0);
    } finally { await replacement.close(); }
    handoff.unsubscribe();
  } finally { await host.close(); }
}

async function runHostedSdkLifecycle() {
  const cwd = await mkdtemp(join(tmpdir(), "pi-runtime-lifecycle-"));
  const agentDir = join(cwd, "agent");
  const calls = [];
  const extension = (pi) => {
    pi.on("session_start", (event) => { calls.push(`start:${event.reason}`); });
    pi.on("session_shutdown", (event) => { calls.push(`shutdown:${event.reason}`); });
    pi.registerCommand("replacement-test", {
      description: "test", handler: async (_args, ctx) => {
        for (const attempt of [() => ctx.newSession(), () => ctx.fork("none")]) await assert.rejects(attempt());
        calls.push("replacement-rejected");
      },
    });
  };
  let host;
  try {
    const modelRuntime = await ModelRuntime.create({ authPath: join(cwd, "auth.json"), modelsPath: null, refreshOnCreate: false });
    const faux = fauxProvider();
    modelRuntime.registerNativeProvider(faux.provider);
    const runtime = await createAgentSessionRuntime(async ({ cwd, agentDir, sessionManager, sessionStartEvent }) => {
      const services = await createAgentSessionServices({
        cwd, agentDir, modelRuntime,
        settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
        resourceLoaderOptions: {
          noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
          additionalThemePaths: HOSTED_THEME_PATHS,
          extensionFactories: [{ name: "hosted-lifecycle", factory: extension }],
          systemPrompt: "Deterministic hosted lifecycle fixture.",
        },
      });
      const result = await createAgentSessionFromServices({
        services, sessionManager, sessionStartEvent, model: faux.getModel(), thinkingLevel: "off", noTools: "all",
      });
      return { ...result, services, diagnostics: services.diagnostics };
    }, { cwd, agentDir, sessionManager: SessionManager.inMemory(cwd) });
    try {
      const ui = await createHostedExtensionUI(runtime.session, agentDir);
      host = createSessionHost({ session: runtime.session, extensionUi: ui, dispose: () => runtime.dispose() });
      await bindHostedExtensions(runtime.session, host, ui);
      assert(calls.includes("start:startup"));
      const submission = await host.submit({ requestId: "extension", message: "/replacement-test" });
      assert.equal((await submission.completion).status, "completed");
      assert(calls.includes("replacement-rejected"));
      const beforeReload = host.getSnapshot();
      await host.reload();
      assert(calls.includes("shutdown:reload"));
      assert(calls.includes("start:reload"));
      const afterReload = host.getSnapshot();
      assert.equal(afterReload.streamId, beforeReload.streamId, "retained-host SDK reload keeps the same counter owners");
      assert(afterReload.sequence > beforeReload.sequence);
      assert(afterReload.extensionUi.revision > beforeReload.extensionUi.revision, "resetting a retained UI never restarts its revision");
      assert(afterReload.extensionUi.editor.revision > beforeReload.extensionUi.editor.revision, "editor revisions remain monotonic during retained-host reload");
      assert.equal("generation" in afterReload.extensionUi, false);
    } finally {
      if (host) await host.close();
      else await runtime.dispose();
    }
    assert(calls.includes("shutdown:quit"));
    console.log("PASS: public SDK and real hosted UI startup/reload/shutdown, replacement rejection, monotonic stream/UI/editor revisions");
  } finally { await rm(cwd, { recursive: true, force: true }); }
}

if (process.argv.includes("--help")) {
  console.log("Usage: node tests/sessions/check-session-host.mjs");
} else {
  await runAutomaticRetry();
  await runStartingRun();
  await runCorrelationReentrancy();
  await runHostedSdkLifecycle();
  await runDequeueTransitions();
  await runSdkRaces();
  await runDirectKernelUnknown();
  await runControlledSmoke();
  await runReloadFailure();
}
