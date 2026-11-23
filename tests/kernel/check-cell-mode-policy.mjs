import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { stringify } from "smol-toml";
import { loadPrkConfig } from "../../src/config/document/load-prk-config.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { validTarget } from "../../src/gateway/wire/instance-parameters/validate-instance-params.ts";

const modes = ["thread", "async", "isolated"];
const invalidModes = [null, true, false, "", "ASYNC", "thread ", "unknown", 1, ["async"], {}];
const code = "await work()"; // Opaque to Gateway, even when mode is omitted.

// Only the target connection is controlled: real pi-env openProcess and Gateway JSONL send/receive stay in the path.
function controlledRunner(frames) {
  let control, buffer = Buffer.alloc(0), generation;
  const emit = (frame) => control.onEvent({ kind: "output", stream: "stdout" }, Buffer.from(JSON.stringify({ generation, ...frame }) + "\n"));
  const connection = {
    async info() { return { features: ["process"] }; },
    async request(op, _params, options) {
      if (op === "process") {
        control = options;
        const closed = Promise.withResolvers();
        options.signal.addEventListener("abort", () => closed.resolve({ json: { exitCode: 0 } }), { once: true });
        // pi-env awaits the connection before onStart; the daemon emits started after that.
        await setImmediate();
        options.onStart(1, "owned");
        options.onEvent({ kind: "started", pid: 42 });
        return closed.promise;
      }
      if (op === "exec") return { json: { exitCode: 0 } }; // Close observes the controlled process group gone.
      assert.equal(op, "processWrite");
      buffer = Buffer.concat([buffer, options.payload]);
      let end;
      while ((end = buffer.indexOf(10)) >= 0) {
        const frame = JSON.parse(buffer.subarray(0, end).toString("utf8"));
        buffer = buffer.subarray(end + 1);
        if (generation === undefined) {
          generation = frame.configuration.generation;
          await setImmediate();
          emit({ kind: "ready", cellId: null, pid: 42, pgid: 42, scoped: false, language: "python", version: "3.12.0" });
          continue;
        }
        assert.equal(frame.generation, generation);
        if (frame.kind === "execute") {
          frames.push(frame);
          emit({ kind: "cell_admitted", cellId: frame.cellId, re: frame.id, mode: frame.mode ?? "async" });
        } else assert.equal(frame.kind, "initialize");
        // An execute must not return a running result with yielding disabled, even with yield_s:0.
        await setImmediate();
        emit({ kind: "cell_end", cellId: frame.cellId, re: frame.id, outcome: "ok" });
      }
      return { json: {} };
    },
  };
  return { connection, generation: "owned", signal: new AbortController().signal, async release() {} };
}

function checkConfiguration(defaults, instance) {
  const { defaultCellMode, maxActiveCells, interruptTimeoutMs, interruptRestart, maxTimerWaitMs, forkserverPreload } = defaults.kernel;
  assert.deepEqual({ defaultCellMode, maxActiveCells, interruptTimeoutMs, interruptRestart, maxTimerWaitMs, forkserverPreload }, {
    defaultCellMode: "thread", maxActiveCells: 4, interruptTimeoutMs: 10_000, interruptRestart: "auto", maxTimerWaitMs: 300_000, forkserverPreload: [],
  });
  const globalOnly = { defaultCellMode: "isolated", maxActiveCells: 8, interruptTimeoutMs: 1500, interruptRestart: "never",
    maxTimerWaitMs: 0, forkserverPreload: ["math", "collections.abc"], asyncExecution: false, reminderLadderMs: [123] };
  const retained = { closeTimeoutMs: 99, executionTimeoutMs: 0, memoryMax: "512M" };
  const instanceWithOptions = { ...instance, kernel: retained };
  const configured = parsePrkConfig({ kernel: { ...globalOnly, startTimeoutMs: 321 } }, { instances: [instanceWithOptions] });
  const inherited = configured.instances[0].kernel.kernelOptions;
  for (const [key, value] of Object.entries(globalOnly)) {
    assert.deepEqual(configured.kernel[key], value, key);
    assert(!Object.hasOwn(inherited, key), `${key} must not leak into persisted instance options`);
  }
  assert.equal(inherited.startTimeoutMs, 321);
  for (const [key, value] of Object.entries(retained)) assert.equal(inherited[key], value, key);
  assert.equal(parsePrkConfig({ kernel: { maxTimerWaitMs: 17_000 } }).kernel.maxTimerWaitMs, 17_000);
  for (const creating of [true, false]) assert(validTarget(instanceWithOptions, creating, defaults.limits));

  for (const [key, value] of Object.entries({ ...globalOnly, isolated: true, async: false })) {
    const target = { ...instance, kernel: { [key]: value } };
    assert.throws(() => parsePrkConfig({}, { instances: [target] }), new RegExp(`instances\\[0\\]\\.kernel\\.${key}.*unsupported field`));
    for (const creating of [true, false]) assert.equal(validTarget(target, creating, defaults.limits), false, key);
  }
  for (const [key, values] of Object.entries({
    defaultCellMode: invalidModes, maxActiveCells: [0, -1, 1.5, true, "4"],
    interruptTimeoutMs: [0, 2_147_483_648], interruptRestart: ["now", "NEVER", true, null],
    maxTimerWaitMs: [-1, 1.5, 2_147_483_648, "0", false, null],
    forkserverPreload: ["math", {}, false, null, [0], [""], [" math"], ["math\n"], [".math"], ["a..b"], ["a/b"], ["3d"], Array(1)],
    isolated: [true, false], async: [true, false],
  })) for (const value of values) {
    assert.throws(() => parsePrkConfig({ kernel: { [key]: value } }), new RegExp(`kernel\\.${key}\\b`));
  }
}

test("kernel_code forwards optional mode and snapshots the live default at admission", { timeout: 30_000 }, async () => {
  const home = await mkdtemp(join(tmpdir(), "prk-mode-"));
  let session, client, gate;
  try {
    process.env.PRK_HOME = home;
    const { agentDir, configPath, instancesPath } = initializePrkHome(home);
    const { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } = await import("@earendil-works/pi-coding-agent");
    const { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentTools } = await import("@earendil-works/pi-ai");
    const { createPythonClient } = await import("../../src/sessions/runtime/kernel/create-python-client.ts");
    const { assembleKernelPlugin } = await import("../../src/plugins/kernel/assemble-kernel-plugin.ts");
    await mkdir(agentDir);
    const instance = { id: "owned", label: "Owned", local: true, cwd: home };
    await writeFile(instancesPath, stringify({ instances: [instance] }), { mode: 0o600 });
    let config = await loadPrkConfig(home);
    const frames = [];
    const sessionManager = SessionManager.inMemory(home);
    client = createPythonClient({ sessionManager, cwd: home, target: config.instances[0], pythonRuntime: { python: "/owned/python" },
      moduleHome: home, sessionOptions: config.session, codemodeOptions: config.codemode,
      dependencies: { kernelExecutionPolicy: () => config.kernel, processWindow: config.processWindow },
      environments: { acquire() { gate.entered.resolve(); return gate.release.promise; } },
    });
    const models = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "kernel-mode-policy", models: [{ id: "controlled" }], tokensPerSecond: 100_000 });
    models.registerNativeProvider(provider.provider);
    const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" });
    const factory = assembleKernelPlugin(client.tool, { client, session: () => session,
      enabled: () => false, toolEnabled: () => true, prepareLoadout: () => ({}),
      afterCompaction: () => client.afterCompaction(), callableTools: () => [],
      prompt: () => assert.fail("disabled kernel prompt must not render"),
    });
    const resourceLoader = new DefaultResourceLoader({ cwd: home, agentDir, settingsManager, noExtensions: true, noSkills: true,
      noContextFiles: true, noPromptTemplates: true, noThemes: true, extensionFactories: [{ name: "kernel", factory }] });
    await resourceLoader.reload();
    ({ session } = await createAgentSession({ cwd: home, agentDir, sessionManager, settingsManager, resourceLoader, modelRuntime: models,
      model: provider.getModel(), thinkingLevel: "off", tools: ["kernel_code"], noTools: "all" }));
    await session.bindExtensions({ mode: "print" });

    const defaults = config;
    const change = async (defaultCellMode) => {
      await writeFile(configPath, stringify({ kernel: { asyncExecution: false, ...(defaultCellMode === undefined ? {} : { defaultCellMode }) } }));
      config = await loadPrkConfig(home);
    };
    let serial = 0, advertised;
    const run = async (args) => {
      const id = `mode-${++serial}`;
      provider.setResponses([(ctx) => {
        advertised = getCurrentTools(ctx.messages).find(({ name }) => name === "kernel_code")?.parameters;
        return fauxAssistantMessage(fauxToolCall("kernel_code", { code, yield_s: 0, ...args }, { id }), { stopReason: "toolUse" });
      }, fauxAssistantMessage("Observed.")]);
      await session.prompt(`Call kernel_code (${id}).`);
      const reply = session.messages.findLast((message) => message.role === "toolResult" && message.toolCallId === id);
      assert(reply, `${id} has no model-visible tool result`);
      return reply;
    };
    const verify = (frame, expectedDefault, mode) => {
      assert.equal(frame.code, code);
      assert.equal(frame.defaultCellMode, expectedDefault, "execute must retain its admission-time global default");
      assert.equal(Object.hasOwn(frame, "mode"), mode !== undefined, "omitting mode must omit the wire field");
      if (mode !== undefined) assert.equal(frame.mode, mode);
    };
    const rows = [[undefined, undefined], ...modes.flatMap((global) => [undefined, ...modes].map((explicit) => [global, explicit]))];
    for (const [global, explicit] of rows) {
      const expectedDefault = global ?? "thread";
      const after = modes[(modes.indexOf(expectedDefault) + 1) % modes.length];
      await change(global);
      gate = { entered: Promise.withResolvers(), release: Promise.withResolvers() };
      const before = frames.length;
      const call = run({ reset: true, ...(explicit === undefined ? {} : { mode: explicit }) });
      try {
        await Promise.race([gate.entered.promise, call.then((reply) => assert.fail(JSON.stringify(reply.content)))]);
        assert.equal(frames.length, before, "hold the runner before its execute frame");
        await change(after);
      } finally { gate.release.resolve(controlledRunner(frames)); await call.catch(() => {}); }
      const reply = await call;
      assert.equal(reply.details?.outcome, "ok", JSON.stringify(reply.content));
      assert.equal(reply.details.mode, explicit ?? "async");
      assert.equal(frames.length, before + 1);
      verify(frames.at(-1), expectedDefault, explicit);
    }
    assert.equal((await run({})).details?.outcome, "ok");
    verify(frames.at(-1), "thread", undefined); // Last admission hot-switched isolated → thread.
    assert.deepEqual(advertised?.properties.mode.anyOf.map(({ const: mode }) => mode), modes);
    assert(!advertised.required.includes("mode"));

    for (const args of [...invalidModes.map((mode) => ({ mode })), { isolated: true }, { async: false }, { asyncExecution: true }, { defaultCellMode: "thread" }]) {
      const before = frames.length;
      const reply = await run(args);
      assert.equal(reply.isError, true, JSON.stringify(args));
      assert.match(reply.content.map(({ text }) => text).join("\n"), new RegExp(Object.keys(args)[0], "i"));
      assert.equal(frames.length, before, `rejected arguments reached the runner: ${JSON.stringify(args)}`);
    }
    checkConfiguration(defaults, instance);
  } finally {
    try {
      await session?.abort();
      await session?.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
      session?.dispose();
      await client?.close();
    }
    finally { await rm(home, { recursive: true, force: true }); }
  }
});
