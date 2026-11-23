import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { checkModeCombinations } from "./tool-mode/check-combinations.mjs";

const home = await mkdtemp(join(tmpdir(), "prk-tool-mode-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const { ArtifactStore } = await import("../../src/artifacts/store/assemble-store.ts");
const nativeNames = ["bash", "edit", "find", "grep", "ls", "read", "write"];
const codeTools = (enabled) => ["kernel_code", "kernel_interrupt", "kernel_read", ...(enabled ? nativeNames : [])].sort();
const text = (message) => message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
const filesProof = (enabled) => "import sys\nassert 'prk_tools.files' in sys.modules\nassert all(callable(globals()[name]) for name in ('read', 'edit', 'write', 'grep'))\n" + (enabled
  ? "try: read('mode-proof.txt')\nexcept Exception as error: assert 'read' in str(error) and 'disabled for this session' in str(error), str(error)\nelse: raise AssertionError('PRK files executed in native mode')\ngateway.write(path='mode-proof.txt', content=str(counter))\nassert gateway.read(path='mode-proof.txt').strip() == str(counter)"
  : "assert all(callable(globals()[name]) for name in ('read', 'edit', 'write', 'grep'))\nwrite('mode-proof.txt', str(counter))\nassert read('mode-proof.txt')['lines'][0]['text'] == str(counter)");
try {
  assert.equal(parsePrkConfig({}).session.localTools, false, "Local tools default off");
  for (const localTools of ["true", 1, null]) assert.throws(() => parsePrkConfig({ session: { localTools } }), /session\.localTools.*boolean/);
  await withTargetFixture(async ({ config, onCleanup }) => {
    await prepareNativeToolArtifacts(home);
    const arch = { x64: "x86_64", arm64: "aarch64" }[process.arch];
    await new ArtifactStore(join(home, "assets")).upload("mode_probe", "one", arch, Readable.from([Buffer.from("#!/bin/sh\nprintf mode-bin-proof\n")]));
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "tool-mode-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    runtime.registerNativeProvider(provider.provider);
    const declarations = [];
    provider.setResponses(Array.from({ length: 160 }, () => (context) => {
      declarations.push(getCurrentTools(context.messages).map(({ name }) => name).sort());
      if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("Mode execution observed.");
      const message = [...context.messages].reverse().find((message) => message.role === "user");
      const code = typeof message.content === "string" ? message.content : text(message);
      return fauxAssistantMessage(fauxToolCall("kernel_code", { code }), { stopReason: "toolUse" });
    }));
    const settings = (localTools = false) => parsePrkConfig({ session: { idleTimeoutMs: 3000, idleCheckIntervalMs: 50, localTools }, memory: { review: false }, targetCacheRoot: join(home, "target-cache") });
    const options = { cwd: home, home, model: "tool-mode-check/controlled", targets: [
      executionTargetFromConfig({ ...config, id: "local", label: "Local fixture", local: true, tags: [], cwd: home }),
      executionTargetFromConfig({ ...config, id: "remote", label: "Tunnel fixture", local: false, tags: [], sshCommand: "/bin/sh", cwd: home }),
    ] };
    const dependencies = { runtimeDependencies: { model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off", autoCompaction: false, cwd: home, agentDir } };
    let host, endpoint, client;
    async function start(localTools = false) {
      host = await createGatewayHost({ ...options, config: settings(localTools) }, dependencies);
      endpoint = await startGateway(host, join(home, "gateway.sock"));
      client = await connectGateway(join(home, "gateway.sock"));
    }
    async function close() {
      await client?.disconnect();
      await endpoint?.close();
      client = endpoint = undefined;
    }
    onCleanup(close);
    await start();
    const worker = (await client.request("createSession", { target: "local" })).session.sessionId;
    let sequence = 0;
    const action = async (name, action, args) => client.request("nativeAction", { sessionId: name, requestId: `action-${++sequence}`, action, ...(args === undefined ? {} : { args }) });
    const change = async (name, mode) => action(name, "tool-mode", { mode });
    const toggle = async (name, enabled) => action(name, "local-tools", { enabled });
    const current = async (name = worker) => (await client.request("nativeCapabilities", { sessionId: name })).target.current;
    async function reload(name = worker) {
      const result = await action(name, "reload");
      assert.equal(result.status, "completed", JSON.stringify(result));
      assert.equal((await current(name)).requiresReload, false, "Resource reload leaves registered native tools unchanged");
    }
    async function run(code, name = worker) {
      const requestId = `run-${++sequence}`;
      const done = Promise.withResolvers();
      const offset = declarations.length;
      const unsubscribe = client.onEvent((event, selected) => {
        if (selected === name && event.type === "operation_completed" && event.details.requestIds.includes(requestId)) done.resolve(event.details);
      });
      await client.request("subscribe", { sessionId: name });
      const timer = setTimeout(() => done.reject(new Error("Mode run did not complete")), 20000);
      try {
        const accepted = await client.request("send", { sessionId: name, requestId, message: code });
        assert.equal(accepted.accepted, true);
        assert.equal((await done.promise).status, "completed");
        const snapshot = await client.request("state", { sessionId: name });
        const result = snapshot.messages.findLast((message) => message.role === "toolResult");
        assert.equal(result.toolName, "kernel_code", "All modes execute the same kernel_code tool");
        assert.equal(result.isError, false, text(result));
        return { result, declarations: declarations.at(-1), requests: declarations.slice(offset) };
      } finally { clearTimeout(timer); unsubscribe(); }
    }
    assert.equal((await current()).localTools, false, "New local session starts off");
    const catalog = await client.request("nativeCapabilities", { sessionId: worker });
    assert.equal(catalog.target.local, true);
    assert(catalog.actions.some((item) => item.name === "local-tools" && item.enabled), "Local switch is a native action");
    const remote = (await client.request("createSession", { target: "remote" })).session.sessionId;
    assert.equal((await current(remote)).localTools, false, "New remote session starts off");
    assert.equal((await client.request("nativeCapabilities", { sessionId: remote })).target.local, false, "Loopback Jupyter does not confer locality");
    const enabledRemote = await toggle(remote, true);
    assert.equal(enabledRemote.status, "completed", "Remote target saves its native seven-tool switch");
    assert.equal((await current(remote)).localTools, true);
    assert.equal((await current(remote)).requiresReload, false, "Remote native mode applies without reload");
    assert.deepEqual((await run(`counter = 9071\n${filesProof(true)}\nprint('REMOTE_ON_PROOF')`, remote)).declarations, codeTools(true), "Remote on exposes all seven target-host Pi tools, not Gateway execution");
    assert.deepEqual((await toggle(remote, false)).data, { localTools: false }, "Remote off is valid");
    assert.equal((await current(remote)).requiresReload, false);
    assert.deepEqual((await run(`assert counter == 9071\n${filesProof(false)}\nprint('REMOTE_DEFAULT_OFF_PROOF')`, remote)).declarations, codeTools(false), "Remote off hides native tools, restores PRK files and retains variables");
    await client.request("wakeSession", { sessionId: worker });
    assert.equal((await change(worker, "local")).status, "failed", "Removed mode is not a native action value");
    for (const args of [undefined, {}, { enabled: "true" }, { enabled: 1 }, { enabled: null }, { enabled: true, mode: "code" }, { enabled: false, extra: true }]) {
      assert.equal((await action(worker, "local-tools", args)).status, "failed", `Invalid switch arguments: ${JSON.stringify(args)}`);
      assert.equal((await current()).localTools, false, "Invalid arguments leave the switch unchanged");
    }
    await run("@tool(persist=True, reason='Reuse for future arithmetic checks across tool modes.')\ndef mode_plus(value):\n    return value + 17\nassert mode_plus(25) == 42");
    const direct = await checkModeCombinations({ sessionId: worker, change, current, toggle, reload, run, filesProof, nativeNames, codeTools, text });
    assert.equal((await change(worker, "code")).status, "completed");
    for (const enabled of [true, false]) {
      const toolStarted = Promise.withResolvers();
      const stopWatching = client.onEvent((event, name) => {
        if (name === worker && event.type === "session_event" && event.details?.sdkType === "tool_execution_start") toolStarted.resolve();
      });
      const timer = setTimeout(() => toolStarted.reject(new Error("Busy kernel tool did not start")), 20000);
      const release = join(home, `switch-release-${enabled}`);
      const running = run(`assert counter == 7\nfrom pathlib import Path\nimport time\nstop_at = time.monotonic() + 10\nwhile not Path(${JSON.stringify(release)}).exists():\n    if time.monotonic() > stop_at: raise TimeoutError('switch release missing')\n    time.sleep(0.01)\nprint('LIVE_SWITCH_FINISHED')`);
      try {
        await toolStarted.promise;
        assert.equal((await client.request("state", { sessionId: worker })).state, "running");
        assert.equal((await toggle(worker, enabled)).status, "completed", "Busy SDK turn accepts saving a native switch change");
        assert.equal((await current()).toolMode, "code");
        assert.equal((await current()).localTools, enabled);
        assert.equal((await current()).requiresReload, false, "Busy switches immediately change permission without reload");
      } finally { clearTimeout(timer); stopWatching(); await writeFile(release, "released"); }
      const live = await running;
      assert.deepEqual(live.requests[0], codeTools(!enabled), "The already-issued provider request keeps its original declarations");
      assert.deepEqual(live.requests[1], codeTools(enabled), "The next SDK request uses the current switch even within a busy run");
      assert.deepEqual((await run("assert counter == 7\nprint('NEXT_MESSAGE_PROOF')")).declarations, codeTools(enabled), "The next message also uses the current declarations");
      assert.equal((await current()).requiresReload, false);
      const applied = await run(`assert counter == 7\n${filesProof(enabled)}\nlibrary_sync()\nassert mode_plus(25) == 42\nprint('SWITCHED_MESSAGE_PROOF')`);
      assert.deepEqual(applied.declarations, codeTools(enabled), "Switches retain variables and saved library functions without restart");
    }
    assert.equal((await change(worker, "direct")).status, "completed");
    assert.equal((await toggle(worker, true)).status, "completed");
    const sleeping = Promise.withResolvers();
    const stopWatchingSleep = client.onEvent((event, name) => {
      if (name === worker && event.type === "snapshot" && event.details.snapshot.state === "sleeping") sleeping.resolve();
    });
    const sleepTimer = setTimeout(() => sleeping.reject(new Error("Session did not idle-sleep")), 20000);
    try {
      if ((await client.request("state", { sessionId: worker })).state !== "sleeping") await sleeping.promise;
    } finally { clearTimeout(sleepTimer); stopWatchingSleep(); }
    assert.equal((await current()).localTools, true, "Sleeping catalog retains the switch");
    await client.request("wakeSession", { sessionId: worker });
    assert.equal((await current()).toolMode, "direct");
    assert.equal((await current()).localTools, true, "Woken runtime retains the switch");
    const restoredTools = [...direct, ...nativeNames].sort();
    const wakeProof = await run("library_sync()\nassert mode_plus(25) == 42\nassert bash(tool_bin('mode_probe'))['stdout'] == 'mode-bin-proof'\nprint('WAKE_PROOF')");
    assert.deepEqual(wakeProof.declarations, restoredTools, "Wake rebuild preserves direct plus native declarations and restores saved tools");
    const offLocal = (await client.request("createSession", { target: "local" })).session.sessionId;
    assert.equal((await current(offLocal)).localTools, false);
    assert.equal((await toggle(offLocal, false)).status, "completed", "Explicit off is a persisted override, not an inherited default");
    await close();
    await start(true);
    assert.equal((await current()).toolMode, "direct", "Mode survives Gateway restart");
    assert.equal((await current()).localTools, true, "Switch survives Gateway restart");
    assert.equal((await current(remote)).localTools, false, "Persisted off wins over a changed default");
    assert.equal((await current(offLocal)).localTools, false, "Persisted local off also wins over a changed true default");
    assert.deepEqual((await run("print('PERSISTED_OFF_PROOF')", offLocal)).declarations, codeTools(false), "Waking a persisted-off local session does not inherit the new default");
    await client.request("wakeSession", { sessionId: worker });
    const restored = await run("library_sync()\nassert mode_plus(25) == 42\nassert bash(tool_bin('mode_probe'))['stdout'] == 'mode-bin-proof'\nprint('RESTORED_PROOF')");
    assert.deepEqual(restored.declarations, restoredTools, "Restart wake uses persisted additive tools");
    for (const target of ["local", "remote"]) {
      const name = (await client.request("createSession", { target })).session.sessionId;
      assert.equal((await current(name)).toolMode, "code");
      assert.equal((await current(name)).localTools, target === "local", "Configured true enables only new local sessions");
      assert.deepEqual((await run("print('CONFIGURED_DEFAULT_PROOF')", name)).declarations, codeTools(target === "local"), "Configured defaults reach effective provider tools");
      if (target === "remote") {
        assert.equal((await toggle(name, true)).status, "completed", "Remote enabling remains valid with a true config default");
        assert.equal((await current(name)).requiresReload, false);
        assert.deepEqual((await run("print('CONFIGURED_REMOTE_ON_PROOF')", name)).declarations, codeTools(true), "Explicitly enabled remote mode loads the full target-host Pi tool set");
      }
      if (target === "local") {
        await client.request("closeSession", { sessionId: name });
        await client.request("recoverSession", { sessionId: name, mode: "new", target: "remote", cwd: home });
        const moved = await client.request("nativeCapabilities", { sessionId: name });
        assert.equal(moved.target.local, false);
        assert.equal(moved.target.current.localTools, false, "Moving to a remote target keeps the existing explicit switch reset");
        assert.deepEqual((await run("print('RETARGET_REMOTE_PROOF')", name)).declarations, codeTools(false), "Retarget remains default-off until the native switch is explicitly enabled");
      }
    }
    console.log(JSON.stringify({ effectiveProviderDeclarations: declarations, restoredMode: "direct", restoredLocalTools: true, busySwitches: [true, false], savedFunctionValue: 42 }));
    console.log("PASS real SDK/Gateway socket/Jupyter/faux: additive declarations, immediate busy native switches, mutually exclusive files/native permissions, retained variables and library functions, defaults, invalid args, target-host Pi tools, sleep/wake and persistence; controlled provider only");
  });
} finally { await rm(home, { recursive: true, force: true }); }
