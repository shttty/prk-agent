import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";

if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) {
  throw new Error("Namespace acceptance requires an owned fixture; unset JUPYTER_URL and JUPYTER_TOKEN.");
}
const root = await mkdtemp(join(tmpdir(), "prk-ns-"));
const { agentDir } = initializePrkHome(root);
await mkdir(agentDir);
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxAssistantMessage, fauxProvider, fauxToolCall } = await import("@earendil-works/pi-ai");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { createSessionCollection } = await import("../../src/sessions/collection/assemble-collection.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { createTarget } = await import("./fixtures/create-target.mjs");
const { createPythonTool } = await import("../../src/kernel/assemble-kernel.ts");
const { createTargetChannels } = await import("../../src/target-channel/channels/assemble-channels.ts");
const { openProcessTransport } = await import("../../src/target-channel/process-transport/open.ts");
const { parseProcessWindowLimits } = await import("../../src/target-environment/process-window/parse-limits.ts");
const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
const target = await createTarget(process.argv[2] ?? "local");
const cleanups = [];
try {
  assert.throws(() => parsePrkConfig({ namespace: { maxChars: 1 } }), /namespace.maxChars/);
  await (async () => {
    const onCleanup = (cleanup) => cleanups.push(cleanup);
    const config = parsePrkConfig({
      session: { workerTools: "code", noExtensions: true },
      namespace: { maxEntries: 8, maxChars: 4000, docstringChars: 60 }, monitor: { enabled: false },
    });
    const limits = parseProcessWindowLimits();
    const channels = createTargetChannels({ options: { ...config.targetConnection, processWindow: limits }, open: async (_machine, signal) => ({ transport: await openProcessTransport(await target.acquire(), target.python, target.root, signal, config.targetConnection.startTimeoutMs, limits), command: "" }) });
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    let collection;
    const host = await createGatewayHost({ cwd: root, home: root, config, model: `${provider.getModel().provider}/${provider.getModel().id}`,
      targets: [executionTargetFromConfig({ id: "namespace-target", label: "namespace-target", local: target.local, python: target.python, sshCommand: target.sshCommand, cwd: target.root })],
    }, {
      runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: root, agentDir, targetChannels: channels,
        createKernel: (hooks) => createPythonTool({ target: "namespace-target", python: target.python, cwd: target.root, acquire: target.acquire, processWindow: limits, memoryMax: "4G", memorySwapMax: "0", scoped: true }, hooks) },
      collectionFactory: (...args) => { collection = createSessionCollection(...args); return collection; },
    });
    const server = await startGateway(host, join(root, "gateway.sock"));
    onCleanup(() => server.close());
    const client = await connectGateway(join(root, "gateway.sock"));
    onCleanup(() => client.disconnect());
    await prepareGatewayEnvironment(host, root, "namespace-target");
    const created = await host.createSession({ target: "namespace-target", cwd: target.root });
    const worker = created.session.sessionId;
    await assert.rejects(client.request("kernelVariables", { sessionId: worker }), (error) => error.code === "UNAVAILABLE");
    assert.equal(host.state(worker).kernel.state, "not_started");
    const run = async (code, title = "Namespace cell", reset = false) => {
      provider.setResponses([fauxAssistantMessage(fauxToolCall("kernel_code", { code, title, reset }), { stopReason: "toolUse" }), fauxAssistantMessage("Observed.")]);
      const accepted = await host.session(worker).submit({ requestId: crypto.randomUUID(), message: "Execute the specified namespace cell." });
      assert.equal(accepted.accepted, true);
      assert.equal((await accepted.completion).status, "completed");
      const result = host.state(worker).messages.findLast((message) => message.role === "toolResult" && message.toolName === "kernel_code");
      assert.equal(result.isError, false, text(result));
      return result;
    };
    await run("assert 'os' not in globals()", "Startup leaves no helper imports");
    await run("x = 1", "Before reset");
    const beforeReset = host.state(worker).kernel.memory.scope;
    const resetResult = await run("print('x' in globals())", "Reset kernel", true);
    assert.match(text(resetResult), /^False\n/);
    assert.notEqual(host.state(worker).kernel.memory.scope, beforeReset);
    await run("x = 1", "Before reset only");
    const beforeResetOnly = host.state(worker).kernel.memory.scope;
    await run("", "Reset only", true);
    assert.notEqual(host.state(worker).kernel.memory.scope, beforeResetOnly);
    await run("assert 'x' not in globals() and callable(phase)", "After reset only");
    await run("x = bytearray(300*1024*1024)", "Allocate large bytearray");
    const large = await run("assert isinstance(x, bytearray) and x[0] == 0 and x[-1] == 0\nprint('kernel alive')", "After large allocation");
    assert.match(text(large), /kernel alive/);
    const x = large.details.namespace.variables.find((entry) => entry.name === "x");
    assert.deepEqual(Object.keys(x).sort(), ["name", "origin", "type"]);
    assert.equal(x.type, "bytearray");
    await client.request("kernelDeleteVariable", { sessionId: worker, name: "x" });
    let result = await run("phase('prepare')\n_private = 5\nlen = 6\nitems = [1, 2]\nscratch = 3\nlong_value = 'x' * 10000\ndef greet(name: str = 'world'):\n    \"\"\"Greet the caller.\n    Second line is not included.\n    \"\"\"\n    return 'Hello ' + name", "Initialize variables");
    assert.deepEqual(result.details.namespace.added.map((entry) => entry.name).sort(), ["_private", "greet", "items", "len", "long_value", "scratch"]);
    const greet = result.details.namespace.added.find((entry) => entry.name === "greet");
    assert.match(greet.signature, /name: str = 'world'/);
    assert.equal(greet.docstring, "Greet the caller.");
    assert.equal(greet.origin.title, "Initialize variables");
    assert.equal(greet.origin.phase, "prepare");
    assert.match(greet.origin.time, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(Object.keys(result.details.namespace.added.find((entry) => entry.name === "long_value")).sort(), ["name", "origin", "type"]);
    assert(!Object.hasOwn(JSON.parse(text(result).split("\n").findLast((line) => line.startsWith("{"))), "variables"));
    result = await run("items.append(3)\nlong_value = 'short'\ndel scratch", "Change variables");
    assert.deepEqual(result.details.namespace.modified.map((entry) => entry.name), ["long_value"]);
    assert.deepEqual(result.details.namespace.deleted, ["scratch"]);
    const listed = await client.request("kernelVariables", { sessionId: worker });
    assert.deepEqual(listed.variables.map((entry) => entry.name).sort(), ["_private", "greet", "items", "len", "long_value"]);
    for (const name of ["_prk", "phase", "items[0]", "items; print('bad')", "missing"]) {
      await assert.rejects(client.request("kernelDeleteVariable", { sessionId: worker, name }), (error) => error.code === "INVALID_REQUEST");
    }
    await run("assert items == [1, 2, 3] and len == 6 and _private == 5");
    const deleted = await client.request("kernelDeleteVariable", { sessionId: worker, name: "items" });
    assert.equal(deleted.state, "idle");
    assert.deepEqual(deleted.namespace.deleted, ["items"]);
    assert(!(await client.request("kernelVariables", { sessionId: worker })).variables.some((entry) => entry.name === "items"));
    assert.deepEqual((await client.request("kernelDeleteVariable", { sessionId: worker, name: "_private" })).namespace.deleted, ["_private"]);
    await run("assert 'items' not in globals() and '_private' not in globals()");
    const runtime = collection.get(worker);
    const busy = Promise.withResolvers();
    const stopObserving = runtime.kernel.subscribe((snapshot) => { if (snapshot.state === "busy") busy.resolve(); });
    const running = run("import time\ntime.sleep(1)", "Busy kernel");
    await busy.promise;
    await assert.rejects(client.request("kernelDeleteVariable", { sessionId: worker, name: "greet" }), (error) => error.code === "BUSY");
    await running;
    stopObserving();

    // Public SDK compaction, with a controlled provider; no synthetic event or shadow transcript.
    runtime.session.settingsManager.applyOverrides({ compaction: { enabled: false, reserveTokens: 1, keepRecentTokens: 1 } });
    provider.setResponses([
      fauxAssistantMessage("Previous cells initialized and updated the retained kernel variables."),
      fauxAssistantMessage("Namespace variables remain in the owned kernel after this turn prefix."),
    ]);
    const compacted = await client.request("nativeAction", { sessionId: worker, requestId: "compact-namespace", action: "compact", args: {} });
    assert.equal(compacted.status, "completed", JSON.stringify(compacted));
    result = await run("assert greet() == 'Hello world'", "After compaction");
    const compactedVariables = JSON.parse(text(result).split("\n").findLast((line) => line.startsWith("{"))).variables;
    assert(compactedVariables.some((entry) => entry.name === "greet"));
    result = await run("assert long_value == 'short'");
    assert(!text(result).includes('"variables":'));

    result = await run("globals().update({'value_' + str(i): 'y' * 1000 for i in range(30)})");
    const summary = result.details.namespace;
    assert.equal(summary.truncated, true);
    for (const entries of [summary.variables, summary.added, summary.modified, summary.deleted]) assert(entries.length <= 8);
    assert(JSON.stringify(summary).length <= 4000);
    await host.closeSession(worker);
    await assert.rejects(client.request("kernelVariables", { sessionId: worker }), (error) => error.code === "UNAVAILABLE");
    assert.equal(host.state(worker).state, "closed");
    console.log("PASS owned Gateway/SDK/stdlib REPL namespace: diffs, mutation, function/origin, caps, guarded wire deletion, and one full list after actual compaction");
  })();
} finally { for (const cleanup of cleanups.reverse()) await cleanup(); await target.close(); await rm(root, { recursive: true, force: true }); }
