import assert from "node:assert/strict";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { createSessionCollection } from "../../src/sessions/collection/assemble-collection.ts";
import { createOwnedEnvironment } from "../fixtures/target-environment/create-owned-environment.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { text, until } from "./fixtures/create-routing-gateway.mjs";

const fixture = await createOwnedEnvironment({ prefix: "prk-bc-" });
try {
  const cwd = fixture.root;
  const python = process.env.PI_TEST_PYTHON ?? "/usr/bin/python3";
  const home = process.env.PRK_HOME;
  const { agentDir } = initializePrkHome(home);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "kernel-language-fixture", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const model = provider.getModel();
  const config = parsePrkConfig({ targetCacheRoot: join(cwd, "target-cache"), kernel: { asyncExecution: true },
    session: { workerTools: "code", noSkills: true, noExtensions: true, noContextFiles: true, noPromptTemplates: true },
    memory: { enabled: false, review: false }, monitor: { enabled: false } });
  let collection;
  const host = await createGatewayHost({ home, cwd, model: `${model.provider}/${model.id}`, config,
    targets: [executionTargetFromConfig({ id: "local", label: "Owned local", cwd, python, local: true })],
  }, {
    runtimeDependencies: { cwd, agentDir, modelRuntime, model, thinkingLevel: "off", autoCompaction: false },
    collectionFactory: (targets, setup) => collection = createSessionCollection(targets, setup),
  });
  try {
    await prepareGatewayEnvironment(host, home, "local");
    const { session: { sessionId } } = await host.createSession({ target: "local", cwd });
    let runtime = collection.get(sessionId);
    let session = host.session(sessionId);
    let serial = 0;
    const select = (language) => host.nativeAction(sessionId, { sessionId, requestId: `language-${++serial}`, action: "kernel-language", args: { language } });
    const state = () => runtime.kernel.getSnapshot();
    const tool = () => runtime.session.getToolDefinition("kernel_code");
    async function call(name, args) {
      await until(() => session.isIdle && runtime.session.isIdle, "idle SDK");
      const id = `language-tool-${++serial}`;
      provider.setResponses([fauxAssistantMessage(fauxToolCall(name, args, { id }), { stopReason: "toolUse" }), fauxAssistantMessage("Observed.")]);
      const admission = await session.submit({ requestId: id, message: "Run the controlled kernel action." });
      assert.equal(admission.accepted, true);
      assert.equal((await admission.completion).status, "completed");
      const entry = runtime.session.messages.findLast((message) => message.role === "toolResult" && message.toolCallId === id);
      assert(entry, `missing ${name} result`);
      return entry;
    }
    assert.equal(state().language, "python");
    assert.equal(runtime.session.getToolDefinition("kernel_language")?.exposure, "model-only");
    assert.equal(runtime.session.getCallableToolNames().includes("kernel_language"), false);
    for (const key of ["mode", "inputs", "outputs"]) assert(Object.hasOwn(tool().parameters.properties, key));
    const thread = await call("kernel_code", { code: "sentinel = 41; sentinel", mode: "thread" });
    assert.equal(thread.details.mode, "thread");
    const asynchronous = await call("kernel_code", { code: "import asyncio\nawait asyncio.sleep(0)\nsentinel" });
    assert.equal(asynchronous.details.mode, "async");
    const isolated = await call("kernel_code", { code: "return sentinel + 1", mode: "isolated", inputs: ["sentinel"], outputs: "answer" });
    assert.equal(isolated.details.mode, "isolated");
    assert.match(text(await call("kernel_code", { code: "answer" })), /42/);
    assert.equal((await call("kernel_code", { code: "answer", mode: "async", inputs: ["answer"] })).isError, true);
    const long = await call("kernel_code", { code: "import asyncio\nawait asyncio.sleep(2)\nprint('previous Python result')", yield_s: 0 });
    const { cell_id: cellId } = JSON.parse(text(long));
    assert(cellId);
    assert.equal(long.details.language, "python");
    assert.equal(host.nativeCapabilities(sessionId).actions.find(({ name }) => name === "kernel-language")?.enabled, false);
    const oldId = state().kernelId;
    const busy = await select("bun");
    assert.equal(busy.data?.code, "BUSY", JSON.stringify(busy));
    assert.equal(state().kernelId, oldId);
    await until(() => !runtime.kernel.hasInFlightCell(), "Python result frozen and saved");
    const switched = await call("kernel_language", { language: "bun" });
    assert.equal(switched.isError, false, text(switched));
    assert.equal(switched.details.variablesLost, true);
    assert.equal(state().language, "bun");
    assert.equal(state().state, "not_started");
    assert.equal(host.state(sessionId).kernelLanguage, "bun");
    assert.match(tool().description, /JavaScript\/TypeScript/u);
    for (const key of ["mode", "inputs", "outputs"]) assert(!Object.hasOwn(tool().parameters.properties, key));
    assert.equal((await call("kernel_code", { code: "return 42", mode: "thread" })).isError, true);
    const js = await call("kernel_code", { code: "const n: number = 42; return [n, typeof sentinel]" });
    assert.equal(js.isError, false, text(js));
    assert.match(text(js), /42.*undefined/u);
    const bunId = state().kernelId;
    assert.notEqual(bunId, oldId);
    assert.equal((await select("bun")).data?.status, "unchanged");
    assert.equal(state().kernelId, bunId);
    const previous = await call("kernel_read", { cell_id: cellId });
    assert.match(text(previous), /previous Python result/);
    assert.equal(previous.details.language, "python");
    assert.equal(host.state(sessionId).kernelCells.find((cell) => cell.cellId === cellId)?.language, "python");

    await host.closeSession(sessionId);
    assert.equal(host.state(sessionId).kernelLanguage, "bun");
    await host.recoverSession(sessionId, { mode: "auto" });
    runtime = collection.get(sessionId);
    session = host.session(sessionId);
    assert.equal(state().language, "bun");
    assert(!Object.hasOwn(tool().parameters.properties, "mode"));
    assert.equal((await call("kernel_code", { code: "return 39 + 3" })).details.language, "bun");
    const back = await select("python");
    assert.equal(back.status, "completed", JSON.stringify(back));
    assert.equal(state().state, "not_started");
    assert.match(text(await call("kernel_code", { code: "'sentinel' in globals()" })), /False/);
  } finally { await host.close(); }
} finally { await fixture.close(); }
console.log("PASS: persisted session language, Python modes, idle-only switching, Bun declarations and original cell receipt");
