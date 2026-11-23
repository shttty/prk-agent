import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { verifyBridgeBinaries } from "./fixtures/verify-bridge-binaries.mjs";

const home = await mkdtemp(join(tmpdir(), "prk-kernel-bridge-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } = await import("@earendil-works/pi-coding-agent");
const { fauxAssistantMessage, fauxProvider, fauxToolCall } = await import("@earendil-works/pi-ai");
const { Type } = await import("typebox");
const { createPythonTool } = await import("../../src/kernel/assemble-kernel.ts");
const { kernelPrelude } = await import("../../src/codemode/kernel-prelude/build-prelude.ts");
const { createTarget } = await import("./fixtures/create-target.mjs");
const { parseProcessWindowLimits } = await import("../../src/target-environment/process-window/parse-limits.ts");
const { DEFAULT_CODEMODE_OPTIONS } = await import("../../src/config/codemode/codemode-options.ts");
const { ArtifactStore } = await import("../../src/artifacts/store/assemble-store.ts");
const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
const target = await createTarget(process.argv[2] ?? "local");
const cleanups = [];
try {
  await (async () => {
    const config = { target: "owned", python: target.python, cwd: target.root, acquire: target.acquire, processWindow: parseProcessWindowLimits(), memoryMax: "4G", memorySwapMax: "0", scoped: false };
    const onCleanup = (cleanup) => cleanups.push(cleanup);
    // Kernel callbacks resolve metadata only; explicit deployment populates the target cache.
    const binDir = join(home, "assets");
    const artifactStore = new ArtifactStore(binDir);
    const cacheDir = join(target.root, "target-cache");
    const owner = createPythonTool(config, { codeMode: true, binDir, prelude: () => kernelPrelude({ targetCacheRoot: cacheDir, codemode: { ...DEFAULT_CODEMODE_OPTIONS, binChunkBytes: 64 } }) });
    onCleanup(() => owner.close());
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });
    const resourceLoader = new DefaultResourceLoader({ cwd: home, agentDir, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true });
    await resourceLoader.reload();
    let pendingSignal;
    let finishLate;
    const pendingStarted = Promise.withResolvers();
    const callbacks = [
      { name: "bridge_text", parameters: Type.Object({}), execute: async () => ({ content: [{ type: "text", text: "plain reply" }], details: undefined }) },
      { name: "bridge_structured", parameters: Type.Object({}), outputSchema: Type.Object({ answer: Type.Number() }), execute: async () => ({ content: [{ type: "text", text: "not the structured reply" }], structuredContent: { answer: 42 }, details: undefined }) },
      { name: "bridge_error", parameters: Type.Object({}), execute: async () => { throw new Error("intentional callback failure"); } },
      { name: "bridge_late", parameters: Type.Object({}), execute: async (_id, _args, signal) => {
        pendingSignal = signal;
        pendingStarted.resolve();
        return new Promise((resolve) => { finishLate = () => resolve({ content: [{ type: "text", text: "late reply" }], details: undefined }); });
      } },
    ].map((tool) => ({ ...tool, label: tool.name, description: "Bridge smoke callback", exposure: "codemode" }));
    const { session } = await createAgentSession({ cwd: home, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off", resourceLoader, settingsManager, sessionManager: SessionManager.create(home, join(home, "sessions")), tools: ["kernel_code", ...callbacks.map((tool) => tool.name)], customTools: [owner.tool, ...callbacks] });
    onCleanup(async () => { await session.abort(); session.dispose(); });
    const run = async (code) => {
      provider.setResponses([fauxAssistantMessage(fauxToolCall("kernel_code", { code, title: "Bridge smoke" }), { stopReason: "toolUse" }), fauxAssistantMessage("Cell observed.")]);
      await session.prompt("Run the specified bridge cell.");
      return session.messages.findLast((message) => message.role === "toolResult" && message.toolName === "kernel_code");
    };
    let result = await run("assert gateway.call('bridge_text') == 'plain reply'\nassert gateway.call('bridge_structured')['answer'] == 42\nprint('bridge values correct')");
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /bridge values correct/);
    // describe answers from the callable declarations without executing any tool.
    result = await run("listed = {item['name']: item['description'] for item in gateway.describe()}\nassert listed['bridge_late'] == 'Bridge smoke callback'\nschema = gateway.describe('bridge_structured')\nassert schema['outputSchema']['properties']['answer']['type'] == 'number' and schema['parameters']['type'] == 'object'\ntry:\n    gateway.describe('missing_tool')\n    raise AssertionError('missing tool described')\nexcept RuntimeError as error:\n    assert 'gateway.describe()' in str(error)\nprint('describe correct')");
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /describe correct/);
    assert.equal(pendingSignal, undefined, "describe must not execute bridge_late");
    result = await run("gateway.call('bridge_error')");
    assert.equal(result.isError, true);
    assert.match(text(result), /intentional callback failure/);
    result = await run("input('ordinary input')");
    assert.equal(result.isError, true);
    assert.match(text(result), /unsupported/);
    result = await run("display({'application/x-prk-trace+json': {'event': 'open', 'operation': 'read', 'args': ['proof.txt']}, 'text/plain': 'RAW_PRIVATE_OUTPUT'}, raw=True)\nprint('public output')");
    assert.equal(result.isError, false, text(result));
    assert.deepEqual(result.details.traces, [{ event: "open", operation: "read", args: ["proof.txt"] }]);
    assert(!text(result).includes("RAW_PRIVATE_OUTPUT"));
    const running = run("retained = 41\ngateway.call('bridge_late')\nretained = -1");
    await pendingStarted.promise;
    await session.abort();
    await running;
    assert.equal(pendingSignal.aborted, true);
    finishLate();
    result = await run("assert retained == 41\nassert gateway.call('bridge_text') == 'plain reply'\nprint('next cell clean')");
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /next cell clean/);
    const persisted = session.sessionManager.getEntries().filter((entry) => entry.type === "message").map((entry) => entry.message);
    assert(persisted.some((message) => message.role === "toolResult" && message.details?.traces?.some((trace) => trace.args.includes("proof.txt"))));

    await verifyBridgeBinaries({ run, binDir, cacheDir, target, artifactStore, onCleanup });

    // The cell deadline stands still only while the user is asked (the `ask` callback); a slow callback of any other tool
    // is work and counts against it.
    const { USER_WAIT_CALLBACK } = await import("../../src/codemode/kernel-protocol/kernel-protocol-schema.ts");
    const shortOwner = createPythonTool(config, { codeMode: true, prelude: () => kernelPrelude({ codemode: DEFAULT_CODEMODE_OPTIONS }) }, { executionTimeoutMs: 1000 });
    onCleanup(() => shortOwner.close());
    const slowTools = [USER_WAIT_CALLBACK, "bridge_slow"].map((name) => ({
      name, label: name, description: "Callback that takes 1.8 s", exposure: "codemode", parameters: Type.Object({}),
      execute: async () => { await new Promise((resolve) => setTimeout(resolve, 1800)); return { content: [{ type: "text", text: `${name} answered` }], details: undefined }; },
    }));
    const { session: shortSession } = await createAgentSession({ cwd: home, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off", resourceLoader, settingsManager, sessionManager: SessionManager.create(home, join(home, "sessions-short")), tools: ["kernel_code", ...slowTools.map((tool) => tool.name)], customTools: [shortOwner.tool, ...slowTools] });
    onCleanup(async () => { await shortSession.abort(); shortSession.dispose(); });
    const runShort = async (code) => {
      provider.setResponses([fauxAssistantMessage(fauxToolCall("kernel_code", { code, title: "Deadline smoke" }), { stopReason: "toolUse" }), fauxAssistantMessage("Cell observed.")]);
      await shortSession.prompt("Run the specified deadline cell.");
      return shortSession.messages.findLast((message) => message.role === "toolResult" && message.toolName === "kernel_code");
    };
    result = await runShort(`print(gateway.call(${JSON.stringify(USER_WAIT_CALLBACK)}))`);
    assert.equal(result.isError, false, `waiting for the user outlives the 1 s cell deadline: ${text(result)}`);
    assert.match(text(result), /ask answered/);
    result = await runShort("print(gateway.call('bridge_slow'))");
    assert.equal(result.isError, true, "any other callback counts against the cell deadline");
    assert.match(text(result), /timed out after 1000ms/);
    console.log(`PASS owned stdlib REPL + real SDK bridge: text/structured/error, unsupported stdin, private MIME persistence, cancel and late reply isolation, explicit binary deployment/cache/arch/errors, disk_usage via ${process.env.PI_TEST_DUST ? "real dust" : "stand-in dust"}, cell deadline paused only while ask waits`);
  })();
} finally { for (const cleanup of cleanups.reverse()) await cleanup(); await target.close(); await rm(home, { recursive: true, force: true }); }
