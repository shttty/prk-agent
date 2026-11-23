import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { checkChildDelivery } from "./codemode/check-child-delivery.mjs";
import { checkDirectoryPaging } from "./codemode/check-directory-paging.mjs";
import { createTarget } from "./fixtures/create-target.mjs";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";
import { readCallableNames } from "../fixtures/gateway-prompt/read-callable-names.mjs";
import { checkCodemodeFilters } from "./fixtures/check-codemode-filters.mjs";
import { prepareCodemodePackages } from "./fixtures/prepare-codemode-packages.mjs";

if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) throw new Error("Unset JUPYTER_URL and JUPYTER_TOKEN; this check owns its stdlib runner.");
const home = await mkdtemp(join(tmpdir(), "prk-codemode-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentTools, getCurrentSystemPrompt } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const text = (message) => typeof message?.content === "string" ? message.content : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const target = await createTarget("local"), cleanups = [];
try {
  await (async () => {
    const onCleanup = (cleanup) => cleanups.push(cleanup);
    const targetCwd = join(home, "target");
    await mkdir(targetCwd);
    const { callbackPackage, otherPackage, todoPackage } = await prepareCodemodePackages(home, agentDir);
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "codemode-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const declarations = [];
    const requestInputs = [];
    const prompts = [];
    const deliveries = [];
    provider.setResponses(Array.from({ length: 100 }, () => async (context) => {
      declarations.push(getCurrentTools(context.messages).map((tool) => tool.name).sort());
      prompts.push(getCurrentSystemPrompt(context.messages));
      requestInputs.push(text(context.messages.findLast((entry) => entry.role === "user")));
      if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("Observed native tool result.");
      const message = [...context.messages].reverse().find((entry) => entry.role === "user");
      const resultNotice = /\[派生会话任务结果[^\n]*\]\n(\{[^\n]+\})/.exec(text(message));
      if (resultNotice) {
        deliveries.push(JSON.parse(resultNotice[1]));
        return fauxAssistantMessage("Received the asynchronous child result and its structured output fields.");
      }
      const command = /^CODE (.*)$/s.exec(text(message));
      if (command) return fauxAssistantMessage(fauxToolCall("kernel_code", { code: JSON.parse(command[1]), title: "Code mode integration" }), { stopReason: "toolUse" });
      if (text(message).includes("CHILD_NATIVE_RESULT")) return fauxAssistantMessage(fauxToolCall("kernel_code", { code: "print('child retained kernel')\ngateway.session_result(summary='CHILD_RESULT_PROOF', artifacts=[], output={'answer':42})", title: "Native child submission" }), { stopReason: "toolUse" });
      return fauxAssistantMessage("Controlled observation without executing a cell.");
    }));
    const limits = parseProcessWindowLimits();
    const createHost = async (config, historyDir) => {
      const channels = createTargetChannels({ options: { ...config.targetConnection, processWindow: limits }, open: async (_machine, signal) => ({ transport: await openProcessTransport(await target.acquire(), target.python, targetCwd, signal, config.targetConnection.startTimeoutMs, limits, { PRK_TARGET_CACHE_ROOT: config.targetCacheRoot }), command: "" }) });
      const host = await createGatewayHost({ cwd: home, home, config, historyDir, model: "codemode-check/controlled", targets: [executionTargetFromConfig({ id: "target", label: "target", local: true, python: target.python, cwd: targetCwd })] }, {
        runtimeDependencies: { model: provider.getModel("controlled"), modelRuntime, thinkingLevel: "off", cwd: home, agentDir, targetChannels: channels,
          createKernel: (hooks) => createPythonTool({ target: "target", python: target.python, cwd: targetCwd, acquire: target.acquire, processWindow: limits, memoryMax: "4G", memorySwapMax: "0", scoped: false }, hooks) },
      });
      try { await prepareGatewayEnvironment(host, home, "target"); }
      catch (error) { await host.close(); throw error; }
      const createWorker = async () => (await host.createSession({ target: "target", cwd: targetCwd })).session.sessionId;
      return { host, createWorker };
    };
    const owned = await createHost(parsePrkConfig({ session: { noExtensions: false }, memory: { review: false }, targetCacheRoot: join(home, "target-cache") }), join(home, "history"));
    const host = owned.host;
    const endpoint = await startGateway(host, join(home, "gateway.sock"));
    const client = await connectGateway(join(home, "gateway.sock"));
    onCleanup(async () => { await client.disconnect(); await endpoint.close(); });
    const worker = await owned.createWorker();
    const workerDeclarationsStart = declarations.length;
    let requestId = 0;
    async function run(code, isError = false, gateway = host, name = worker) {
      const runtime = gateway.session(name);
      const operation = await runtime.submit({ requestId: `code-${++requestId}`, message: `CODE ${JSON.stringify(code)}` });
      assert(operation.accepted);
      assert.equal((await operation.completion).status, "completed");
      const snapshot = runtime.getSnapshot();
      const projected = snapshot.messages.findLast((entry) => entry.role === "toolResult" && entry.toolName === "kernel_code");
      const result = projected?.outputPreview ? gateway.toolContent(name, projected.toolCallId).result : projected;
      assert(result);
      assert.equal(result.isError, isError, text(result));
      return result;
    }
    await checkDirectoryPaging({ run, text });
    let result = await run("phase('target helpers')\nwrite('records.txt', 'alpha=2\\nbeta=3\\n')\nview = read('records.txt')\nassert [line['text'] for line in view['lines']] == ['alpha=2', 'beta=3']\na = view['lines'][1]['ref']\nprint(edit('records.txt', [{'op': 'replace', 'start': a, 'end': a, 'text': 'beta=7'}]))\nhits = grep(r'beta=\\d+', 'records.txt')\nassert hits['matches'] == 1\nassert [(row['number'], row['text']) for row in hits['files'][0]['lines']] == [(2, 'beta=7')]\nassert 'records.txt' in ls()['entries']\ncommand = bash('pwd; printf shell-proof > shell.txt')\nassert command['exit_code'] == 0\nfrom pathlib import Path\nassert command['stdout'].strip() == str(Path.cwd())\nprint('TARGET_HELPERS_OK')");
    assert.equal(await readFile(join(targetCwd, "records.txt"), "utf8"), "alpha=2\nbeta=7\n");
    assert.equal(await readFile(join(targetCwd, "shell.txt"), "utf8"), "shell-proof");
    await assert.rejects(readFile(join(home, "records.txt")), (error) => error.code === "ENOENT");
    assert(result.details.phases.some((phase) => phase.title === "target helpers"));
    result = await run("phase('bad hashline edit')\nedit('records.txt', [{'op': 'replace', 'start': 'unknown', 'end': 'unknown', 'text': 'changed'}])", true);
    assert(result.details.phases.some((phase) => phase.title === "bad hashline edit"));
    assert.equal(await readFile(join(targetCwd, "records.txt"), "utf8"), "alpha=2\nbeta=7\n");
    assert(prompts.at(-1).includes("Use read() to view files and edit() for targeted changes; do not view with open()/Path/cat or edit with str.replace + write()/sed."));
    assert(prompts.at(-1).includes("Batch changes to one file into one edit() call."));
    assert(prompts.at(-1).includes("Use open/write only to create a file, rewrite it wholesale, or process raw data in Python."));
    assert(prompts.at(-1).includes("Path/open is for processing data, not for viewing or editing."));
    const helperExample = /Hashline edit example: ([^\n]+)/.exec(prompts.at(-1))?.[1];
    assert(helperExample, "the actual provider prompt supplies an executable helper example");
    await run("write('example.txt', 'before\\n')");
    result = await run(helperExample);
    assert.equal(await readFile(join(targetCwd, "example.txt"), "utf8"), "updated\n");
    assert(result.details.traces.some((trace) => trace.operation === "read" && trace.args[0]?.includes("example.txt")));
    assert(result.details.traces.some((trace) => trace.operation === "write" && trace.args[0]?.includes("example.txt")));
    const grepExample = /Hashline grep example: ([^\n]+)/.exec(prompts.at(-1))?.[1];
    assert(grepExample, "the effective provider prompt supplies a grep-to-edit example");
    await run("write('example.txt', 'needle\\n')");
    await run(grepExample);
    assert.equal(await readFile(join(targetCwd, "example.txt"), "utf8"), "updated\n");
    result = await run("listed = gateway.session_list()\ncalled = gateway.call('session_list', {})\nassert isinstance(listed, list)\nassert isinstance(called, list)\nassert listed == called");
    assert(result.details.callbacks.some((callback) => callback.name === "session_list" && callback.status === "ok"));
    result = await run("gateway.session_send(to='missing-sdk-session', message='Do not deliver', expectReply=False)", true);
    assert(result.details.callbacks.some((callback) => callback.name === "session_send" && callback.status === "error"));
    result = await run("gateway.read(path='records.txt')", true);
    assert(result.details.callbacks.some((callback) => callback.name === "read" && callback.status === "error"));
    await run("assert gateway.extension_value(value=25)['answer'] == 42\nassert gateway.call('extension_value', {'value': 1})['answer'] == 18");
    result = await run("gateway.extension_failure()", true);
    assert.match(text(result), /extension callback failure/);
    const executions = [];
    const subscription = host.session(worker).subscribe((event) => { if (event.type === "session_event" && event.details?.sdkType?.startsWith("tool_execution_")) executions.push(event.details); });
    result = await run("assert gateway.call('extension_default', {}) == 'extension_default-result'\nassert gateway.call('extension_direct', {}) == 'extension_direct-result'\nassert gateway.call('extension_deferred', {}) == 'extension_deferred-result'\nprint('DIRECT_DEFAULT_EXPLICIT_AND_DEFERRED_OK')");
    subscription.unsubscribe();
    assert.match(text(result), /DIRECT_DEFAULT_EXPLICIT_AND_DEFERRED_OK/);
    for (const name of ["extension_default", "extension_direct", "extension_deferred"]) assert(result.nestedCalls.calls.some((call) => call.name === name && call.status === "ok"));
    // Live wire: the SDK marks nested calls with parentToolCallId (id `<parent>/<n>`); the model-issued kernel_code call carries none.
    const outer = executions.find((details) => details.sdkType === "tool_execution_start" && details.toolName === "kernel_code");
    assert(outer && outer.parentToolCallId === undefined && !outer.toolCallId.includes("/"));
    for (const name of ["extension_default", "extension_direct", "extension_deferred"]) {
      for (const phase of ["start", "end"]) assert(executions.some((details) => details.sdkType === `tool_execution_${phase}` && details.toolName === name && details.parentToolCallId === outer.toolCallId && details.toolCallId.startsWith(`${outer.toolCallId}/`)), `${name} ${phase} carries parentToolCallId`);
    }
    assert.equal(executions.filter((details) => details.parentToolCallId === undefined).every((details) => details.toolName === "kernel_code"), true, "only the outer call lacks parentToolCallId");
    await run("assert 'web_search' in {tool['name'] for tool in gateway.describe()}");
    assert(readCallableNames(prompts.at(-1)).includes("web_search"), "The unfiltered code worker advertises the plugin callback to its provider");
    await run("assert gateway.web_search() == 'search-result'");
    for (const name of ["extension_model_only", "extension_hidden"]) {
      result = await run(`gateway.call('${name}', {})`, true);
      assert.match(text(result), new RegExp(`Tool ${name} not found`));
    }
    if (todoPackage) {
      result = await run("import json\nassert (gateway.todo_list())['todos'] == []\nfirst = {'id': 'fixture-1', 'content': 'isolated PRK todo', 'status': 'pending'}\nassert (gateway.todo_list(todos=[first]))['todos'] == [first]\nfirst['status'] = 'completed'\nsecond = {'id': 'fixture-2', 'content': 'isolated merge', 'status': 'in_progress'}\nmerged = (gateway.todo_list(todos=[first, second], merge=True))\nassert merged['todos'] == [first, second]\nassert merged['summary'] == {'total': 2, 'pending': 0, 'in_progress': 1, 'completed': 1, 'cancelled': 0, 'blocked': 0}\nassert (gateway.todo_list()) == merged\nprint('TODO_READ_WRITE_MERGE_OK', json.dumps(merged))");
      assert.match(text(result), /TODO_READ_WRITE_MERGE_OK/);
      assert.equal(result.details.callbacks.filter((callback) => callback.name === "todo_list" && callback.status === "ok").length, 4);
      const todoRead = await run("print('TODO_RETAINED_READ', gateway.call('todo_list', {}))");
      assert.match(text(todoRead), /fixture-2/);
      console.log(text(result), text(todoRead));
      await client.request("reload", { sessionId: worker });
      const todoReloadRead = await run("print('TODO_AFTER_RELOAD', gateway.call('todo_list', {}))");
      // appendEntry snapshots survive a native resource reload (prk-todolist TS core).
      assert.match(text(todoReloadRead), /fixture-2/);
      console.log(text(todoReloadRead));
    }
    const savedName = `late_${randomUUID().replaceAll("-", "")}`;
    result = await run(`@tool(persist=True, reason="Reuse for future arithmetic callback discovery probes.")\ndef ${savedName}(value):\n    return value + 17\nassert ${savedName}(25) == 42\nassert any(entry['name'] == '${savedName}' for entry in library_sync())`);
    const callableName = `prk_saved_${savedName}`;
    result = await run(`getattr(gateway, '${callableName}')(args=[25])`, true);
    assert(result.details.callbacks.some((callback) => callback.name === callableName && callback.status === "error"));
    assert(prompts.at(-1).includes(callableName), "next worker prompt discovers the late public callable name");
    await run(`assert ${savedName}(25) == 42`, false);
    result = await run("gateway.not_registered_anywhere(value=1)", true);
    assert(result.details.callbacks.some((callback) => callback.name === "not_registered_anywhere" && callback.status === "error"));
    await checkCodemodeFilters({ createHost, home, callbackPackage, otherPackage, run, prompts, text, onCleanup });
    console.log("CODEMODE_CALLBACK_MATRIX_COMPLETE: remaining child creation depends on the production session factory");
    await checkChildDelivery({ host, sessionId: worker, run, text, deliveries });
    for (const [index, tools] of declarations.entries()) if (index >= workerDeclarationsStart) assert.deepEqual(tools, ["kernel_code", "kernel_interrupt", "kernel_read"], `Code-mode provider request ${index}; latest user payload: ${JSON.stringify(requestInputs[index])}`);
    console.log("PASS real SDK/Gateway/stdlib REPL: default/explicit direct and codemode callbacks, native exposure, package/tool deny/allow, kernel-only provider declarations, target helpers and native lifecycle; controlled provider only");
  })();
} finally { for (const cleanup of cleanups.reverse()) await cleanup(); await target.close(); await rm(home, { recursive: true, force: true }); }
