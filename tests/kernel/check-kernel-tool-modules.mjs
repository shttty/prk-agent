import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
// Owned stdlib REPL + Gateway + faux: no module execution on the Gateway, no paid calls.
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { createTarget } from "./fixtures/create-target.mjs";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { checkKernelSwitches } from "./kernel-switches/check-kernel-switches.mjs";
import { checkCapabilityInput } from "./kernel-switches/check-capability-input.mjs";

const target = await createTarget("local");
const home = target.home, cleanups = [];
const previousHome = process.env.HOME;
process.env.HOME = join(home, "user-home");
await mkdir(process.env.HOME);
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentSystemMessage, getSystemMessageText } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { createFileSession } = await import("./fixtures/create-file-session.mjs");
const { kernelPrelude } = await import("../../src/codemode/kernel-prelude/build-prelude.ts");
const { kernelModuleBootstrap } = await import("../../src/codemode/module-payload/build-bootstrap.ts");
const { cacheKernelToolCatalog } = await import("../../src/codemode/module-catalog/cache-catalog.ts");
const { kernelToolCatalog } = await import("../../src/codemode/module-catalog/read-kernel-tool-catalog.ts");
const { discoverKernelToolCatalog } = await import("../../src/codemode/module-catalog/discover-kernel-tool-catalog.ts");
const { scan } = await import("../../src/codemode/module-payload/scan-kernel-modules.ts");
const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
const moduleFile = async (root, name, source, dependencies) => {
  const directory = join(root, name);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "__init__.py"), source);
  if (dependencies) await writeFile(join(directory, "prk-tool.toml"), stringify({ dependencies }));
};
try {
  const modules = join(home, "kernel-tools");
  await mkdir(modules);
  await writeFile(join(modules, "public_value.py"), "def value():\n    return 40\n");
  await moduleFile(modules, "automatic", await readFile(new URL("./kernel-tool-modules/automatic.py", import.meta.url), "utf8"));
  await moduleFile(modules, "broken", "import prk_deliberately_missing_dependency_7013\n");
  await moduleFile(modules, "needs_python", "raise AssertionError('unsupported wheel code must not execute')\n", { python: [{ name: "fixture-package", version: "1.0", filename: "fixture_package-1.0-py3-none-any.whl", sha256: "a".repeat(64) }] });
  await moduleFile(modules, "needs_binary", "from prk_tool import host\nBINARY = host.tool_bin('rg')\n", { binaries: ["rg"] });
  await moduleFile(modules, "bad_config", "from prk_tool import config\nDEFAULT_CONFIG = {'count': 1}\noptions = config(__name__)\n");
  await moduleFile(modules, "unknown_config", "from prk_tool import config\nDEFAULT_CONFIG = {'count': 1}\noptions = config(__name__)\n");
  await moduleFile(modules, "invalid_default", "DEFAULT_CONFIG = {'value': object()}\n");
  await moduleFile(modules, "needs_callback", "from prk_tool import host\nhost.call('session_list')\n");
  await moduleFile(modules, "async_export", "from prk_tool import tool\n@tool\nasync def async_probe():\n    yield 1\n");
  await moduleFile(modules, "conflict", "from prk_tool import tool\n@tool\ndef bash(command):\n    return 'must not replace legacy bash'\n");
  await moduleFile(modules, "legacy_package", "raise AssertionError('legacy package code must not execute')\n");
  await writeFile(join(modules, "legacy_package/prk-tool.json"), "{}");
  await writeFile(join(modules, "legacy_file.py"), "raise AssertionError('legacy file code must not execute')\n");
  await writeFile(join(modules, "legacy_file.prk-tool.json"), "{}");
  const scanned = await scan(modules);
  for (const name of ["legacy_package", "legacy_file"]) {
    assert.match(scanned.get(name).error, /prk-tool\.json.*rename.*prk-tool\.toml/u, `${name}: scan records an actionable module.error`);
  }
  assert.deepEqual(scanned.get("needs_binary").dependencies.binaries, ["rg"], "TOML manifest dependencies reach the real scanner");
  await (async () => {
    const onCleanup = (cleanup) => cleanups.push(cleanup);
    const limits = parseProcessWindowLimits();
    const config = { target: "fixture", python: target.python, cwd: target.root, acquire: target.acquire, processWindow: limits, memoryMax: "4G", memorySwapMax: "0", scoped: false };
    const kernels = async () => JSON.parse(await target.observe(`${JSON.stringify(target.python)} - <<'PY'\nimport os,json\nfound=[]\nfor name in os.listdir('/proc'):\n if not name.isdigit(): continue\n try:\n  if os.readlink('/proc/'+name+'/cwd') == ${JSON.stringify(target.root)} and b'def bootstrap_kernel' in open('/proc/'+name+'/cmdline','rb').read(): found.append(int(name))\n except OSError: pass\nprint(json.dumps(sorted(found)))\nPY\n`));
    const baseline = await kernels();
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "tool-modules", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const document = { session: { noExtensions: true, noSkills: true }, memory: { review: false }, kernelTools: { automatic: { delta: 2 }, bad_config: { count: "invalid" }, unknown_config: { other: 1 } } };
    await writeFile(join(home, "config.toml"), stringify(document));
    const parsed = parsePrkConfig(document);
    const channels = createTargetChannels({ options: { ...parsed.targetConnection, processWindow: limits }, open: async (_machine, signal) => ({ transport: await openProcessTransport(await target.acquire(), target.python, target.root, signal, parsed.targetConnection.startTimeoutMs, limits), command: "" }) });
    const host = await createGatewayHost({ cwd: home, home, config: parsed, model: "tool-modules/controlled", targets: [
      executionTargetFromConfig({ id: "fixture", label: "fixture", local: true, python: target.python, cwd: target.root }),
    ] }, { runtimeDependencies: { cwd: home, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off", targetChannels: channels, createKernel: (hooks) => createPythonTool(config, hooks) } });
    const endpoint = await startGateway(host, join(home, "gateway.sock"));
    onCleanup(() => endpoint.close());
    const client = await connectGateway(join(home, "gateway.sock"));
    onCleanup(() => client.disconnect());
    const cold = (await client.request("capabilitiesList")).catalog;
    assert.equal(cold.entries.find((entry) => entry.id === "kernel:module:files")?.pending, true);
    assert.equal(cold.entries.find((entry) => entry.id === "kernel:module:automatic")?.pending, true);
    assert.deepEqual(await kernels(), baseline, "Catalog discovery allocates no kernel and executes no module code");
    await prepareGatewayEnvironment(host, home, "fixture");
    const createWorker = async () => (await host.createSession({ target: "fixture", cwd: target.root })).session.sessionId;
    const worker = await createWorker();
    const peer = await createWorker();
    // Deploy and create before introducing the missing dependency that the lazy kernel must report.
    await moduleFile(modules, "missing_binary", "raise AssertionError('missing binary code must not execute')\n", { binaries: ["prk_missing_binary_7013"] });
    const prompts = [];
    const run = async (code) => {
      provider.setResponses([
        (context) => { prompts.push(getSystemMessageText(getCurrentSystemMessage(context.messages))); return fauxAssistantMessage(fauxToolCall("kernel_code", { code }), { stopReason: "toolUse" }); },
        (context) => { prompts.push(getSystemMessageText(getCurrentSystemMessage(context.messages))); return fauxAssistantMessage("Observed module result."); },
      ]);
      const operation = await host.session(worker).submit({ requestId: crypto.randomUUID(), message: "Run the isolated module fixture." });
      assert.equal(operation.accepted, true);
      assert.equal((await operation.completion).status, "completed");
      const result = host.state(worker).messages.findLast((entry) => entry.role === "toolResult" && entry.toolName === "kernel_code");
      assert.equal(result.isError, false, text(result));
      return result;
    };
    const first = await run(`assert automatic_probe() == 42\nfrom prk_tools import automatic\nassert automatic.calls == 1\nassert callable(read) and callable(tool) and callable(library_sync)\npeers = automatic.call_peers()\nassert [peer['sessionId'] for peer in peers] == [${JSON.stringify(peer)}], peers\nassert all('capability' not in peer for peer in peers)\nprint('MODULE_CALL_OK_7013')`);
    assert.match(text(first), /MODULE_CALL_OK_7013/);
    assert(first.details.callbacks.some((callback) => callback.name === "session_list" && callback.status === "ok"));
    await client.request("closeSession", { sessionId: peer });
    assert(!text(first).includes("UI_ONLY_MODULE_PROGRESS_7013"), "SDK progress is UI-only");
    assert(first.details.traces.some((trace) => trace.operation === "read" && trace.args.some((arg) => arg.includes("module-probe"))));
    assert(prompts.at(-1).includes("automatic_probe(extra: int = 0) -> int: AUTOMATIC_MODULE_DESCRIPTION_7013"));
    assert(!prompts.at(-1).includes("This second docstring line"));
    const warm = (await client.request("capabilitiesList")).catalog;
    assert.equal(warm.entries.find((entry) => entry.id === "kernel:automatic_probe")?.module, "automatic");
    assert(!warm.entries.some((entry) => entry.id === "kernel:module:automatic"), "Inspect replaces the pending row");
    for (const name of ["read", "edit", "write", "grep"]) assert.equal(warm.entries.find((entry) => entry.id === `kernel:${name}`)?.module, "files");
    assert(!warm.entries.some((entry) => entry.name === "_automatic_alias"), "Private decorated aliases are never exported");
    for (const name of ["broken", "needs_python", "missing_binary", "bad_config", "unknown_config", "invalid_default", "needs_callback", "async_export", "conflict", "legacy_package", "legacy_file"]) {
      const entry = warm.entries.find((entry) => entry.id === `kernel:module:${name}`);
      assert.equal(entry?.available, false, name);
      assert.equal(typeof entry.error, "string", name);
    }
    assert.match(warm.entries.find((entry) => entry.id === "kernel:module:needs_python").error, /Python wheel distribution is not implemented/);
    assert.match(warm.entries.find((entry) => entry.id === "kernel:module:unknown_config").error, /unknown configuration keys/);
    assert.match(warm.entries.find((entry) => entry.id === "kernel:module:bad_config").error, /must have type int/);
    assert.equal(warm.entries.find((entry) => entry.id === "kernel:module:needs_binary")?.available, true);
    const action = async (action, args) => {
      const result = await client.request("nativeAction", { sessionId: worker, requestId: crypto.randomUUID(), action, ...(args ? { args } : {}) });
      assert.equal(result.status, "completed", JSON.stringify(result));
      return result.data;
    };
    await checkKernelSwitches({ run, action, host, sessionId: worker, prompts, text, home });
    await client.request("closeSession", { sessionId: worker });
    assert.deepEqual(await kernels(), baseline);

    // Isolated builtin-directory seam: exercise the same real loader, never mutate repository modules.
    const overrideHome = join(home, "override-home"), builtin = join(home, "builtin-fixture");
    await moduleFile(builtin, "shared", "raise AssertionError('shadowed builtin must not execute')\n");
    await moduleFile(builtin, "public_api", "from .values import value\n");
    await writeFile(join(builtin, "public_api", "values.py"), "def value():\n    return 88\n");
    await moduleFile(join(overrideHome, "kernel-tools"), "shared", "from prk_tool import tool\nfrom prk_tools.public_api import value\ncalls = 0\n@tool\ndef override_probe():\n    \"\"\"USER_OVERRIDE_DESCRIPTION_7013\"\"\"\n    global calls\n    calls += 1\n    return value()\n");
    const coldOverride = await discoverKernelToolCatalog(overrideHome, undefined, builtin);
    assert.equal(coldOverride.find((entry) => entry.name === "module:shared")?.overridesBuiltin, true);
    assert.equal(coldOverride.find((entry) => entry.name === "module:public_api")?.pending, true);
    assert.deepEqual(await kernels(), baseline, "Builtin cold listing executes no code or kernel allocation");
    let report = [];
    const fileKernel = await createFileSession(target, {
      onToolCatalog: (catalog) => { report = catalog; },
      prelude: async () => [await kernelPrelude({ moduleHome: join(home, "empty-modules") }), "import json as _prk_json, sys as _prk_sys, types as _prk_types", await kernelModuleBootstrap(overrideHome, {}, builtin), "_prk_runtime.namespace.update({name: getattr(_prk, name) for name in _prk._exports})", "del _prk_json, _prk_sys, _prk_types"].join("\n"),
    });
    onCleanup(() => fileKernel.close());
    const owner = fileKernel.owner;
    const execute = async (code) => { const { result } = await fileKernel.run(code); assert.equal(result.details.outcome, "ok", text(result)); };
    await execute("assert override_probe() == 88\nfrom prk_tools import shared\nassert shared.calls == 1");
    await execute("write('retained-file.txt', 'before\\n')\nshared.retained_view = read('retained-file.txt')\nprint(shared.retained_view)");
    assert.equal(report.find((entry) => entry.name === "override_probe")?.overridesBuiltin, true);
    assert.equal(report.find((entry) => entry.name === "module:public_api")?.available, true);
    await owner.clear();
    await execute("from prk_tools import shared\nassert shared.calls == 1\nassert override_probe() == 88\nassert shared.calls == 2");
    await execute("from pathlib import Path\nr = shared.retained_view['lines'][0]['ref']\nedit('retained-file.txt', [{'op':'replace','start':r,'end':r,'text':'after'}])\nassert Path('retained-file.txt').read_bytes() == b'after\\n'");
    await owner.restart();
    await execute("from prk_tools import shared\nassert shared.calls == 0\nassert override_probe() == 88");
    await owner.close();
    assert.deepEqual(await kernels(), baseline);
    cacheKernelToolCatalog(overrideHome, "available", [{ name: "probe", signature: "()", description: "ok", module: "m", available: true }]);
    cacheKernelToolCatalog(overrideHome, "unavailable", [{ name: "module:m", signature: "", description: "error", module: "m", available: false, error: "fixture" }]);
    assert.deepEqual(kernelToolCatalog(overrideHome).map((entry) => entry.name), ["probe"], "Global union prefers successful availability");
    assert.equal(kernelToolCatalog(overrideHome, "unavailable")[0].error, "fixture", "Instance report remains exact");
    assert(!kernelToolCatalog(join(home, "other-home")).some((entry) => entry.name === "probe"), "Catalog cache is home-scoped");
    await checkCapabilityInput({ config, home, onCleanup });
    assert.deepEqual(await kernels(), baseline, "Permission wire checks close their owned kernel");
    console.log("PASS tool modules: automatic catalog/prompt/call, inspect metadata, public package imports, binary store delivery, isolated failures/config/deferred wheels, user override, switches, same-process state and fresh restart, no-kernel listing");
  })();
} finally {
  for (const cleanup of cleanups.reverse()) await cleanup();
  await target.close();
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  await rm(home, { recursive: true, force: true });
}
