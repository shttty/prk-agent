// Real Pi/faux + owned Jupyter/target channel/host; no mocked transport or paid model.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { buildNativeToolHost } from "../../src/remote-extensions/bundle/build-native-tool-host.ts";

assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Only owned Jupyter fixtures are allowed");
assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");
assert.equal(process.env.SHELL, "/bin/bash");
const root = await mkdtemp(join(tmpdir(), "prk-remote-tool-lifecycle-"));
const previousHome = process.env.HOME;
process.env.HOME = join(root, "home");
const home = join(root, "prk");
const { agentDir } = initializePrkHome(home);
const text = (result) => (result?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const q = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const until = async (read, predicate, timeout = 10000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await read();
    if (predicate(value)) return value;
    await delay(25);
  }
  throw new Error("Remote tool lifecycle observation timed out");
};

try {
  await prepareNativeToolArtifacts(home);
  const { DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, createAgentSession } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
  const { ArtifactStore } = await import("../../src/artifacts/store/assemble-store.ts");
  const { buildRemoteExtensionPackage } = await import("../../src/remote-extensions/bundle/build-extension-package.ts");
  const { createRemoteExtensionFactory } = await import("../../src/remote-extensions/generation/create-extension-factory.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { createTargetChannels } = await import("../../src/target-channel/channels/assemble-channels.ts");
  const { openProcessTransport } = await import("../../src/target-channel/process-transport/open.ts");
  const source = join(root, "plugin");
  await mkdir(source);
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "@prk-tests/tool-lifecycle", version: "1.0.0", private: true,
    type: "module", files: ["index.js"], pi: { extensions: ["./index.js"], location: "target" } }));
  await writeFile(join(source, "index.js"), `import { Type } from "typebox";
import { setTimeout as delay } from "node:timers/promises";
export default function(pi) {
  pi.registerTool({ name: "remote_slow", label: "Slow remote fixture", description: "Complete after six seconds.",
    parameters: Type.Object({}), async execute() {
      await delay(6000);
      return { content: [{ type: "text", text: "PLUGIN_COMPLETED" }], details: { pid: process.pid } };
    } });
  pi.on("session_info_changed", async () => { await delay(6000); });
  pi.on("session_shutdown", async () => { await delay(6000); });
}
`);
  const packed = JSON.parse((await promisify(execFile)("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", root], { cwd: source })).stdout);
  const pkg = await buildRemoteExtensionPackage({ store: new ArtifactStore(join(home, "assets")), source: join(root, packed[0].filename) });
  await writeFile(join(root, "content.txt"), "HOST_STILL_USABLE\n");
  await withTargetFixture(async (fixture) => {
    const config = parsePrkConfig({ monitor: { enabled: false }, targetConnection: { startTimeoutMs: 15000 } });
    const channels = createTargetChannels({ options: config.targetConnection, async open(_machine, signal, limits) {
      return { command: "", transport: await openProcessTransport(await fixture.runtime.acquire(), fixture.config.python, fixture.config.cwd, signal, config.targetConnection.startTimeoutMs, limits) };
    } });
    const failures = [];
    let generation;
    let closed = false;
    const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
    const loader = new DefaultResourceLoader({ cwd: root, agentDir, settingsManager,
      noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      systemPrompt: "Exercise only the owned lifecycle fixture.",
      extensionFactories: [{ name: "remote-lifecycle", factory: createRemoteExtensionFactory({ channels, machine: "fixture",
        storeDir: join(home, "assets"), artifacts: (platform) => buildNativeToolHost({ store: new ArtifactStore(join(home, "assets")), platform }), nativeTools: true, cwd: root, projectTrusted: true,
        packages: [{ name: pkg.name, artifacts: pkg, extensions: pkg.extensions }], requestTimeoutMs: 2000, onGeneration: (host) => { generation = host; }, onError: (error) => failures.push(error) }) }],
    });
    let session;
    fixture.onCleanup(async () => { try { if (!closed) await generation?.close(); } finally { session?.dispose(); } });
    await loader.reload();
    assert(generation?.registration, "The real host must load successfully");
    assert.notEqual(generation.registration.pid, process.pid);
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ tokensPerSecond: 100000 });
    modelRuntime.registerNativeProvider(provider.provider);
    ({ session } = await createAgentSession({ cwd: root, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off",
      resourceLoader: loader, settingsManager, sessionManager: SessionManager.inMemory(root), tools: ["bash", "read", "remote_slow"] }));
    await session.bindExtensions({});
    const hostPid = generation.registration.pid;
    const invoke = async (name, args, expectError = false) => {
      const id = randomUUID();
      provider.setResponses([fauxAssistantMessage(fauxToolCall(name, args, { id }), { stopReason: "toolUse" }), fauxAssistantMessage("Observed fixture outcome.")]);
      await session.prompt("Exercise the fixture");
      const result = session.messages.findLast((entry) => entry.role === "toolResult" && entry.toolCallId === id);
      assert(result, "The SDK must record the actual remote tool outcome");
      assert.equal(result.isError, expectError, text(result));
      return result;
    };
    const read = async () => assert.match(text(await invoke("read", { path: "content.txt" })), /HOST_STILL_USABLE/);
    let started = performance.now();
    assert.match(text(await invoke("bash", { command: "sleep 6; printf NATIVE_COMPLETED" })), /NATIVE_COMPLETED/);
    assert(performance.now() - started >= 6000, "Native bash must outlive the two-second control deadline");
    await read();
    started = performance.now();
    const plugin = await invoke("remote_slow", {});
    assert.match(text(plugin), /PLUGIN_COMPLETED/);
    assert.equal(plugin.details.pid, hostPid);
    assert(performance.now() - started >= 6000, "Plugin execute must use the same deadline-free policy");
    await read();

    // Observe the actual target PID before model interruption, not merely a cancelled SDK result.
    const pidFile = join(root, "bash.pid");
    const timed = await invoke("bash", { command: "sleep 6; printf SHOULD_NOT_COMPLETE", timeout: 1 }, true);
    assert.doesNotMatch(text(timed), /SHOULD_NOT_COMPLETE/);
    await read();
    const running = invoke("bash", { command: `echo $$ > ${q(pidFile)}; exec sleep 60` }, true);
    const pid = await until(async () => Number(await readFile(pidFile, "utf8").catch(() => "")), (value) => Number.isInteger(value) && value > 0);
    process.kill(pid, 0);
    await session.abort();
    await running;
    await until(() => { try { process.kill(pid, 0); return false; } catch (error) { if (error.code === "ESRCH") return true; throw error; } }, Boolean);
    await read();
    assert.equal(generation.registration.pid, hostPid);
    assert.deepEqual(failures, [], "Long execution and abort must not fail the host generation");
    console.log(JSON.stringify({ proof: "remote-execute-lifecycle", requestTimeoutMs: 2000, nativeSeconds: 6, pluginSeconds: 6, abortedPid: pid, hostPid, subsequentRead: true }));

    // Hooks, like execute, outlive the control deadline; shutdown retains it.
    started = performance.now();
    await session.extensionRunner.emit({ type: "session_info_changed", reason: "name" });
    assert(performance.now() - started >= 6000, "A six-second hook must outlive the two-second control deadline");
    assert.deepEqual(failures, [], "Slow hooks must not fail or replace the generation");
    assert.equal(generation.registration.pid, hostPid);
    await read();
    await assert.rejects(generation.close(), /Remote extension shutdown timed out; outcome is unknown, request was not replayed/);
    closed = true;
    assert.equal(failures.length, 1);
    assert.match(failures[0].message, /Remote extension shutdown timed out; outcome is unknown, request was not replayed/);
    await until(() => { try { process.kill(hostPid, 0); return false; } catch (error) { if (error.code === "ESRCH") return true; throw error; } }, Boolean);
    console.log("PASS remote tool lifecycle: native/plugin execute and hooks outlive control deadline, abort removes target PID, same host remains usable, shutdown still times out");
  }, { tempParent: root, allowHidden: true, rootDir: () => "/" });
} finally {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
