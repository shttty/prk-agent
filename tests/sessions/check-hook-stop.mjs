import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
import { checkDeadlineFreeHook } from "./hook-stop/check-deadline-free-hook.mjs";
import { checkAsynchronousHooks } from "./hook-stop/check-asynchronous-hooks.mjs";
import { checkFrozenRecovery } from "./hook-stop/check-frozen-recovery.mjs";
import { writeHookPlugins } from "./hook-stop/write-hook-plugins.mjs";
// Real Gateway/Pi/faux + owned Jupyter/target channel/scoped host. No paid model calls.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";

assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Only owned Jupyter fixtures are allowed");
assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");
assert.equal(process.env.SHELL, "/bin/bash", "Run with SHELL=/bin/bash");
const root = await mkdtemp(join(tmpdir(), "prk-hook-stop-"));
const previousHome = process.env.HOME;
process.env.HOME = join(root, "gateway-home");
const home = join(root, "gateway");
const { agentDir, configPath } = initializePrkHome(home);
const localEvents = join(root, "local-events.jsonl");
const remoteEvents = join(root, "remote-events.jsonl");
const observerEvents = join(root, "observer-events.jsonl");
const counter = join(root, "frozen-side-effects.jsonl");
const releases = new Set();
const exists = (path) => access(path).then(() => true, (error) => { if (error.code === "ENOENT") return false; throw error; });
const events = async (path) => (await readFile(path, "utf8").catch((error) => { if (error.code === "ENOENT") return ""; throw error; }))
  .trim().split("\n").filter(Boolean).map(JSON.parse);
const text = (message) => (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const proof = (name, details) => console.log(JSON.stringify({ proof: name, ...details }));
const within = async (promise, milliseconds, label) => {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${milliseconds} ms`)), milliseconds); })]);
  } finally { clearTimeout(timer); }
};
const until = async (read, predicate, label, timeout = 20000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (predicate(value)) return value;
    await delay(20);
  }
  throw new Error(`Hook-stop observation timed out: ${label}`);
};
const waitEvent = (path, predicate, label) => until(() => events(path), (rows) => rows.some(predicate), label)
  .then((rows) => rows.findLast(predicate));

try {
  await prepareNativeToolArtifacts(home);
  const { DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, createAgentSession } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
  const { createRemoteExtensionFactory } = await import("../../src/remote-extensions/generation/create-extension-factory.ts");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { createTargetChannels } = await import("../../src/target-channel/channels/assemble-channels.ts");
  const { openProcessTransport } = await import("../../src/target-channel/process-transport/open.ts");
  const { ArtifactStore } = await import("../../src/artifacts/store/assemble-store.ts");
  const { buildNativeToolHost } = await import("../../src/remote-extensions/bundle/build-native-tool-host.ts");
  const pkg = await writeHookPlugins({ root, home, agentDir, localEvents, observerEvents, remoteEvents, counter });

  await withTargetFixture(async (fixture) => {
    const document = { monitor: { enabled: false }, targetConnection: { startTimeoutMs: 15000 }, memory: { review: false },
      session: { noExtensions: false, bootstrapNoSkills: true, workerTools: "code", idleTimeoutMs: 600000 },
      remoteHost: { memoryMax: 1073741824, memorySwapMax: 0, abortTimeoutMs: 250 } };
    await writeFile(configPath, stringify(document));
    const configuration = parsePrkConfig(document);
    const channels = createTargetChannels({ options: { ...configuration.targetConnection, processWindow: configuration.processWindow }, async open(machine, signal, limits) {
      assert.equal(machine, "owned");
      return { command: "", transport: await openProcessTransport(await fixture.runtime.acquire(), fixture.config.python, fixture.config.cwd, signal, configuration.targetConnection.startTimeoutMs, limits) };
    } });
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const faux = fauxProvider({ provider: "hook-stop-controlled", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
    modelRuntime.registerNativeProvider(faux.provider);
    const generations = [];
    const host = await createGatewayHost({ cwd: root, home, noSkills: true, historyDir: join(home, "history"),
      model: "hook-stop-controlled/controlled", thinkingLevel: "off", config: configuration,
      targets: [executionTargetFromConfig({ ...fixture.config, id: "owned", label: "Owned hook stop", local: false, sshCommand: "exec /bin/sh", tags: [], cwd: root })],
    }, { runtimeDependencies: { model: faux.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir, targetChannels: channels },
      onRemoteExtensionGeneration(generation, context) { generations.push({ ...context, host: generation }); } });
    let endpoint;
    let client;
    let directGeneration;
    let directSession;
    fixture.onCleanup(async () => {
      const outcomes = await Promise.allSettled([
        (async () => {
          try {
            await Promise.all([...releases].map((path) => writeFile(path, "release\n")));
            await directGeneration?.close();
          } finally { directSession?.dispose(); }
        })(),
        (async () => {
          client?.disconnect();
          if (endpoint) await endpoint.close(); else await host.close();
        })(),
      ]);
      const failures = outcomes.filter((outcome) => outcome.status === "rejected").map((outcome) => outcome.reason);
      if (failures.length) throw new AggregateError(failures, "Owned hook-stop cleanup failed");
    });
    const socket = join(root, "gateway.sock");
    endpoint = await startGateway(host, socket);
    client = await connectGateway(socket);
    const monitorEvents = [];
    client.onCollectionEvent((event) => {
      if (event.type === "session_monitor" && event.details?.monitor?.remoteHost) monitorEvents.push({ sessionId: event.sessionId, ...event.details.monitor.remoteHost });
    });
    await client.request("subscribeSessions");
    const active = (worker, packageName = pkg.source) => generations.findLast((entry) => entry.sessionId === worker && entry.package === packageName)?.host;
    const native = async (worker, action, args) => {
      const result = await client.request("nativeAction", { sessionId: worker, requestId: randomUUID(), action, ...(args ? { args } : {}) });
      assert.equal(result.status, "completed", JSON.stringify(result));
      return result.data;
    };
    const create = async () => {
      const worker = (await client.request("createSession", { target: "owned" })).session.sessionId;
      await native(worker, "local-tools", { enabled: true });
      await native(worker, "reload");
      assert(active(worker)?.registration, "The owned worker needs a real target host");
      assert.equal(active(worker, "Pi native tools"), active(worker), "Native tools and the target plugin share this worker's generation");
      return worker;
    };
    const start = async (worker, toolName, args) => {
      const id = randomUUID();
      faux.setResponses([fauxAssistantMessage(fauxToolCall(toolName, args, { id }), { stopReason: "toolUse" }), fauxAssistantMessage("Observed hook fixture.")]);
      const admission = await host.nativeSend(worker, { sessionId: worker, requestId: randomUUID(), message: `Owned hook fixture ${id}`, mode: "plain" });
      assert.equal(admission.accepted, true, JSON.stringify(admission));
      return { id, admission };
    };
    const resultOf = (worker, run) => {
      const result = host.state(worker).messages.findLast((message) => message.role === "toolResult" && message.toolCallId === run.id);
      assert(result, `The SDK must record the actual outcome for ${run.id}`);
      return result;
    };
    const invoke = async (worker, toolName, args) => {
      const run = await start(worker, toolName, args);
      assert.equal((await within(run.admission.completion, 30000, "Normal owned turn")).status, "completed");
      const result = resultOf(worker, run);
      assert.equal(result.isError, false, text(result));
      return { ...run, result };
    };
    const normal = async (worker) => {
      const token = randomUUID();
      const run = await invoke(worker, "hook_probe", { mode: "normal", token });
      assert.equal(run.result.details.phase, "original");
      assert.equal(run.result.details.pid, active(worker).registration.pid);
      for (const type of ["tool_call", "tool_result"]) assert((await events(observerEvents)).some((entry) => entry.token === token && entry.event === type), `The other local plugin still receives ${type}`);
      assert((await events(remoteEvents)).some((entry) => entry.token === token && entry.event === "other-handler"), "Another target handler remains usable");
      return run;
    };
    const cancel = async (worker, run, deadline = 1000) => {
      const started = performance.now();
      const completion = await within((async () => {
        const requested = await host.session(worker).cancel({ operationId: run.admission.operationId });
        assert.equal(requested.status, "requested");
        return run.admission.completion;
      })(), deadline, "Gateway worker.cancel to terminal operation");
      const durationMs = performance.now() - started;
      assert.equal(completion.status, "cancelled", JSON.stringify(completion));
      assert.equal(completion.error, undefined);
      assert(durationMs < deadline, `Stop took ${durationMs} ms`);
      return { durationMs, completion };
    };
    const worker = await create();
    await normal(worker);
await checkAsynchronousHooks({ sessionId: worker, active, start, waitEvent, localEvents, remoteEvents, cancel, resultOf, events, normal, proof, root, releases, host });
await checkFrozenRecovery({ sessionId: worker, host, invoke, active, client, exists, waitEvent, remoteEvents, counter, start, cancel, until, normal, proof, document, text, monitorEvents, pkg, create, events });
    // Production config deliberately has no request deadline. Exercise the factory's control deadline directly.
    const failures = [];
    const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
    const loader = new DefaultResourceLoader({ cwd: root, agentDir, settingsManager,
      noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      systemPrompt: "Exercise only the owned slow-hook fixture.",
      extensionFactories: [{ name: "hook-stop-slow", factory: createRemoteExtensionFactory({ channels, machine: "owned", storeDir: join(home, "assets"),
        artifacts: (platform) => buildNativeToolHost({ store: new ArtifactStore(join(home, "assets")), platform }), packages: [{ name: pkg.name, artifacts: pkg, extensions: pkg.extensions }], nativeTools: false, cwd: root, projectTrusted: true,
        hostOptions: document.remoteHost, requestTimeoutMs: 2000, onGeneration: (generation) => { directGeneration = generation; }, onError: (error) => failures.push(error) }) }],
    });
    await loader.reload();
    assert(directGeneration?.registration, "The slow-hook supplemental check needs a real target host");
    ({ session: directSession } = await createAgentSession({ cwd: root, agentDir, modelRuntime, model: faux.getModel(), thinkingLevel: "off",
      resourceLoader: loader, settingsManager, sessionManager: SessionManager.inMemory(root), tools: ["hook_probe"] }));
    await directSession.bindExtensions({});
    await checkDeadlineFreeHook({ directGeneration, directSession, faux, fauxAssistantMessage, fauxToolCall, waitEvent, remoteEvents, within, text, events, failures, proof });
    console.log("PASS hook stop: local/remote async hooks cancel, originals survive late results, frozen host reload retains history/kernel and isolates another session, slow hooks have no fixed deadline");
  }, { tempParent: root, allowHidden: true, rootDir: () => "/" });
} finally {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
