import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createTarget } from "./fixtures/create-target.mjs";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";
import { DEFAULT_KERNEL_OPTIONS } from "../../src/config/kernel/kernel-options.ts";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { verifyLibraryLifecycle } from "../fixtures/tool-library/verify-lifecycle.mjs";
import { verifyGatewayCallbacks } from "../fixtures/tool-library/verify-gateway-callbacks.mjs";

assert.equal(process.env.JUPYTER_URL, undefined);
assert.equal(process.env.JUPYTER_TOKEN, undefined);
const environment = await createTarget(process.argv[2] ?? "local");
const home = environment.home;
const configuration = { python: environment.python, cwd: environment.root, acquire: environment.acquire,
  processWindow: parseProcessWindowLimits(), memoryMax: "4G", memorySwapMax: "0", scoped: false };
const cleanups = [];
const onCleanup = (cleanup) => cleanups.push(cleanup);
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { ToolLibrary } = await import("../../src/codemode/tool-library/assemble-tool-library.ts");
const { registerToolLibrary } = await import("../../src/plugins/tool-library/register-library.ts");
const { createPythonTool } = await import("../../src/kernel/assemble-kernel.ts");
const { kernelPrelude } = await import("../../src/codemode/kernel-prelude/build-prelude.ts");
const { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } = await import("@earendil-works/pi-coding-agent");
const { fauxAssistantMessage, fauxProvider, fauxToolCall } = await import("@earendil-works/pi-ai");
const { Type } = await import("typebox");
const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");

try {
  await verifyLibraryLifecycle(home);

  {
    const kernelHome = join(home, "kernel-library");
    let catalog = new ToolLibrary(kernelHome);
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const create = async (target) => {
      const owner = createPythonTool({ ...configuration, target }, {
        codeMode: true,
        prelude: (scoped) => kernelPrelude({ kernel: { ...DEFAULT_KERNEL_OPTIONS, scoped }, library: catalog.list().filter((item) => item.status !== "archived") }),
      });
      onCleanup(() => owner.close());
      const provider = fauxProvider({ provider: `library-${target}`, tokensPerSecond: 10000 });
      modelRuntime.registerNativeProvider(provider.provider);
      const manager = SessionManager.inMemory(home);
      const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });
      let detach;
      const resourceLoader = new DefaultResourceLoader({ cwd: home, agentDir, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true,
        extensionFactories: [{ name: "library", factory: (pi) => { detach = registerToolLibrary(pi, catalog, target, () => owner, () => manager.getSessionId()); } }],
      });
      await resourceLoader.reload();
      const idleTool = { name: "library_idle", label: "Idle library execution", exposure: "model-only", description: "Call a saved tool while the owned kernel is idle.", parameters: Type.Object({ name: Type.String(), args: Type.Array(Type.Unknown()) }),
        execute: async (_id, params, signal, _update, ctx) => {
          const outcome = await ctx.executeTool(params.name, { args: params.args }, { signal });
          return { ...outcome.result, isError: outcome.isError };
        },
      };
      const { session } = await createAgentSession({ cwd: home, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off", resourceLoader, settingsManager, sessionManager: manager,
        tools: ["kernel_code", "library_idle", "prk_saved_*", "prk_library_*"], customTools: [owner.tool, idleTool],
      });
      let closed = false;
      const close = async () => { if (closed) return; closed = true; await session.abort(); detach?.dispose(); session.dispose(); await owner.close(); };
      onCleanup(close);
      const run = async (code, method = "kernel_code", args = { code, title: "Tool library proof" }) => {
        provider.setResponses([fauxAssistantMessage(fauxToolCall(method, args), { stopReason: "toolUse" }), fauxAssistantMessage("Observed actual result.")]);
        await session.prompt("Execute the specified deterministic library operation.");
        return session.messages.findLast((message) => message.role === "toolResult" && message.toolName === method);
      };
      return { owner, session, run, close };
    };
    const first = await create("with-import");
    let result = await first.run("import math\n@tool(persist=True, reason='  Calculate integer-root estimates for recurring numeric analysis.  ')\ndef root_sum(value: int, extra=1):\n    '''Integer root plus extra.'''\n    return math.isqrt(value) + extra\nassert root_sum(81, extra=2) == 11\nassert root_sum(100) == 11\nassert root_sum(225) == 16\nprint('persisted source ran')");
    assert.equal(result.isError, false, text(result));
    const saved = catalog.active("root_sum");
    assert.equal(saved.distinctSessions, 1);
    assert.equal(saved.successfulCalls, 3);
    assert.equal(saved.status, "staging", "three successes in one native session do not promote");
    assert.equal(saved.reason, "Calculate integer-root estimates for recurring numeric analysis.");
    assert.match(saved.signature, /value: int/);
    assert.equal(saved.docstring, "Integer root plus extra.");
    assert(first.session.getCallableToolNames().includes("prk_saved_root_sum"), "dynamic public registration survives wildcard worker allowlist");
    result = await first.run("root_sum(-1)");
    assert.equal(result.isError, true, "failed Python calls are not successful uses");
    assert.equal(catalog.active("root_sum").successfulCalls, 3);
    result = await first.run("gateway.call('prk_saved_root_sum', {'args': [81]})");
    assert.equal(result.isError, true, "busy-kernel nested execution must fail rather than deadlock");
    assert.equal(first.owner.getSnapshot().state, "idle");
    assert.equal(catalog.active("root_sum").distinctSessions, 1);
    assert.equal(catalog.active("root_sum").successfulCalls, 3);
    const firstKernelId = first.owner.getSnapshot().kernelId;
    const firstSessionId = first.session.sessionId;
    await first.close();

    catalog = new ToolLibrary(kernelHome);
    assert.equal(catalog.active("root_sum").successfulCalls, 3);
    assert.equal(catalog.active("root_sum").reason, "Calculate integer-root estimates for recurring numeric analysis.");
    const fresh = await create("fresh-kernel");
    result = await fresh.run("assert root_sum(144, extra=3) == 15\nprint('fresh kernel loaded stored function')");
    assert.equal(result.isError, false, text(result));
    assert.notEqual(fresh.owner.getSnapshot().kernelId, firstKernelId);
    assert.notEqual(fresh.session.sessionId, firstSessionId);
    assert.equal(catalog.active("root_sum").distinctSessions, 2);
    assert.equal(catalog.active("root_sum").successfulCalls, 4, "reloaded Python wrapper records exactly one success");
    result = await fresh.run(undefined, "library_idle", { name: "prk_saved_root_sum", args: [169] });
    assert.equal(result.isError, false, text(result));
    assert.match(text(result), /14/);
    assert.equal(catalog.active("root_sum").distinctSessions, 2, "idle SDK call uses the same native session id");
    assert.equal(catalog.active("root_sum").successfulCalls, 5, "idle SDK execution records exactly one success, not a second Python-wrapper use");
    result = await fresh.run(undefined, "library_idle", { name: "prk_saved_root_sum", args: [-1] });
    assert.equal(result.isError, true, "failed idle SDK execution is not a successful use");
    assert.equal(catalog.active("root_sum").successfulCalls, 5);

    const moduleDirectory = join(environment.root, "target-import");
    result = await fresh.run(`from pathlib import Path\nimport sys\nPath(${JSON.stringify(moduleDirectory)}).mkdir()\nPath(${JSON.stringify(join(moduleDirectory, "prk_actual_dependency.py"))}).write_text('VALUE = 37\\n')\nsys.path.insert(0, ${JSON.stringify(moduleDirectory)})\nimport prk_actual_dependency\n@tool(persist=True, reason='Read deployment-specific values for recurring target diagnostics.')\ndef imported_value():\n    '''Return an imported value.'''\n    return prk_actual_dependency.VALUE\nassert imported_value() == 37`);
    assert.equal(result.isError, false, text(result));
    const missing = await create("missing-import");
    result = await missing.run("library_sync()\ntry:\n    imported_value()\nexcept RuntimeError:\n    pass\nelse:\n    raise AssertionError('missing target import was not detected')");
    assert.equal(result.isError, false, text(result));
    assert.equal(catalog.list("missing-import").find((item) => item.name === "imported_value").available, false);
    assert.equal(catalog.active("imported_value").successfulCalls, 1, "missing imports do not count as successful calls");
    assert.equal(catalog.list("fresh-kernel").find((item) => item.name === "imported_value").available, true);
    assert(!missing.session.getCallableToolNames().includes("prk_saved_imported_value"));
    result = await fresh.run("assert imported_value() == 37");
    assert.equal(result.isError, false, text(result));
    const reloaded = new ToolLibrary(kernelHome).list("missing-import").find((item) => item.name === "imported_value");
    assert.equal(reloaded.available, undefined, "actual per-instance failures do not survive shared catalog reload");
    assert.equal(reloaded.unavailableReason, undefined);
    assert.equal(reloaded.successfulCalls, 2);
    assert.equal(reloaded.reason, "Read deployment-specific values for recurring target diagnostics.");
    result = await missing.run(`import sys\nsys.path.insert(0, ${JSON.stringify(moduleDirectory)})\nlibrary_sync()\nassert imported_value() == 37\nassert root_sum(196) == 15`);
    assert.equal(result.isError, false, text(result));
    assert.equal(catalog.active("root_sum").status, "promoted", "third distinct native SDK session auto-promotes after true kernel execution");
    assert.equal(catalog.active("root_sum").successfulCalls, 6);
    assert.equal(catalog.active("imported_value").successfulCalls, 3);
    assert.equal(catalog.list("missing-import").find((item) => item.name === "imported_value").available, true);
    assert(missing.session.getCallableToolNames().includes("prk_saved_imported_value"));
    catalog.change("archive", "root_sum");
    assert(!fresh.session.getCallableToolNames().includes("prk_saved_root_sum"));
    result = await fresh.run("library_sync()\nassert 'root_sum' not in globals()");
    assert.equal(result.isError, false, text(result));
    catalog.change("restore", "root_sum");
    assert(fresh.session.getCallableToolNames().includes("prk_saved_root_sum"));

    await verifyGatewayCallbacks({ modelRuntime, environment, configuration, home, agentDir, onCleanup, text });
  }
  console.log("PASS tool library required reasons and cumulative successful calls, lifecycle/capacities/manual immunity/versions/aging, inspected persistence to fresh kernel, actual idle SDK execution, and per-instance missing imports");
} finally {
  for (const cleanup of cleanups.reverse()) await cleanup();
  await environment.close();
}
