import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
// Real SDK/Gateway/target-daemon terminal consumers plus one API/Vite browser group; faux provider only.
// Run with PI_TEST_PYTHON, PI_TEST_PLAYWRIGHT and PI_TEST_CHROMIUM; it owns its local target fixture.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createTerminalModelRequests } from "./terminal-dispatch/create-model-requests.mjs";
import { checkModelTerminalBrowser } from "./model-terminals/check-browser.mjs";
import { checkTerminalCommands } from "./model-terminals/check-commands.mjs";

for (const name of ["PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) if (!process.env[name]) throw new Error(`${name} is required for the model-terminal browser check.`);
process.env.SHELL = "/bin/bash";
delete process.env.FOO; // The restart proof must not inherit FOO from the test runner.
const root = await mkdtemp(join(tmpdir(), "prk-model-terminals-"));
const text = (message) => typeof message?.content === "string" ? message.content : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const eventsIn = (message) => {
  const value = JSON.parse(text(message));
  const events = Array.isArray(value) ? value : value.events;
  assert(Array.isArray(events) && events.length > 0, "terminal wake content contains structured events");
  return events;
};
async function deadline(promise, label, timeout = 30_000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), timeout); })]); }
  finally { clearTimeout(timer); }
}
async function until(read, check, label) {
  const end = Date.now() + 20_000;
  for (;;) {
    const value = await read();
    if (check(value)) return value;
    if (Date.now() >= end) throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

try {
  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
    const { agentDir } = initializePrkHome(root);
    await mkdir(agentDir, { recursive: true });
    const cwd = join(tempRoot, "target");
    await mkdir(cwd);
    const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
    const { fauxProvider, fauxAssistantMessage } = await import("@earendil-works/pi-ai");
    const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
    const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
    const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
    const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "model-terminal-check", models: [{ id: "controlled" }], tokensPerSecond: 100_000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const consumedResults = new Map();
    const wakes = [];
    const issued = [];
    let answeredQuiet = false;
    const terminalRequests = createTerminalModelRequests();
    provider.setResponses(Array.from({ length: 300 }, () => (context) => {
      const last = context.messages.at(-1);
      const continuation = terminalRequests.resume(context);
      if (continuation) return continuation;
      if (last?.role === "toolResult") {
        consumedResults.set(last.toolCallId, last);
        return fauxAssistantMessage("Observed the actual tool result.");
      }
      const request = /^TERMINAL_FIXTURE (\{.*\})$/s.exec(text(last));
      if (request) {
        const { id, tool, args } = JSON.parse(request[1]);
        issued.push(tool);
        return terminalRequests.issue(context, { id, tool, args });
      }
      // A custom trigger is converted by the SDK to user-role LLM content, not a synthetic user submission.
      assert.equal(last?.role, "user");
      const events = eventsIn(last);
      wakes.push(...events);
      const quiet = events.find((event) => event.kind === "quiet" && event.result.command.includes('read -p "ok? [y/N] "'));
      if (quiet && !answeredQuiet) {
        answeredQuiet = true;
        assert.equal(quiet.result.status, "running");
        assert.match(quiet.result.output, /ok\? \[y\/N\]/);
        assert(quiet.quiet_ms >= 250);
        issued.push("terminal_textsend");
        return terminalRequests.issue(context, { tool: "terminal_textsend", args: { text: "y", name: "main", yield_s: 0 }, id: "quiet-answer" });
      }
      return fauxAssistantMessage("Observed the structured terminal event.");
    }));
    let gateway, client;
    onCleanup(async () => {
      const failures = [];
      for (const close of [() => client?.disconnect(), () => gateway?.close()]) {
        try { await close(); } catch (error) { failures.push(error); }
      }
      if (failures.length) throw new AggregateError(failures, "Model-terminal fixture cleanup failed");
    });
    const host = await createGatewayHost({
      cwd: root, home: root, model: "model-terminal-check/controlled",
      config: parsePrkConfig({
        session: { workerTools: "direct", idleTimeoutMs: 60_000, capabilities: { "lazy:group:tools:package:<inline:terminals>": true } },
        memory: { review: false },
        targetCacheRoot: join(tempRoot, "cache"),
        terminal: { yieldMs: 2000, foregroundQuietMs: 5000, quietLadderMs: [250, 5_000], outputBytes: 2048, scrollbackLines: 1000, historyCommands: 30 },
      }),
      targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "Owned terminal fixture", local: true, tags: [], cwd })],
    }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off" } });
    const socket = join(root, "gateway.sock");
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    await prepareGatewayEnvironment(host, root, "fixture");
    const worker = (await client.request("createSession", { target: "fixture" })).session.sessionId;
    const runtime = host.session(worker);
    // Host idle does not cover SDK turns started by terminal events.
    let sdkSettled = true;
    const sdkLifecycle = runtime.subscribe((event) => {
      if (event.type !== "session_event") return;
      if (event.details?.sdkType === "agent_start") sdkSettled = false;
      if (event.details?.sdkType === "agent_settled") sdkSettled = true;
    });
    onCleanup(() => sdkLifecycle.unsubscribe());
    let sequence = 0;
    async function run(tool, args) {
      await until(() => runtime.getSnapshot(), (snapshot) => snapshot.state === "idle" && sdkSettled, `${tool} waits for host and SDK idle`);
      const id = `terminal-fixture-${++sequence}`;
      const operation = await runtime.submit({ requestId: id, message: `TERMINAL_FIXTURE ${JSON.stringify({ id, tool, args })}` });
      assert.equal(operation.accepted, true, operation.error);
      assert.equal((await deadline(operation.completion, `${tool} completion`)).status, "completed");
      const result = runtime.getSnapshot().messages.find((message) => message.role === "toolResult" && message.toolCallId === id);
      assert(result, `${tool} result is recorded in the SDK transcript`);
      assert.equal(result.isError, false, text(result));
      assert.equal(text(consumedResults.get(id)), text(result), "the faux model consumes the real tool result");
      return result;
    }
    function terminalResult(result) {
      assert.equal(result.name, "main");
      assert.equal(typeof result.command_id, "string");
      assert.equal(typeof result.command, "string");
      assert(["done", "running", "killed"].includes(result.status));
      assert(result.exit_code === null || Number.isInteger(result.exit_code));
      assert.equal(result.cwd, cwd);
      assert(result.duration_ms >= 0);
      assert.equal(typeof result.output, "string");
      assert.equal(typeof result.truncated, "boolean");
      assert(result.total_bytes >= 0);
      return result;
    }
    const call = async (tool, args) => terminalResult(JSON.parse(text(await run(tool, args))));

    const { sequenceResult, full, folded } = await checkTerminalCommands({ call, run, runtime, wakes, consumedResults, until, eventsIn, terminalResult, submissions: () => sequence, text, cwd });

    assert.equal((await client.request("nativeAction", { sessionId: worker, requestId: "terminal-code-mode", action: "tool-mode", args: { mode: "code" } })).status, "completed");
    await client.request("terminalOpen", { sessionId: worker, name: "code-human" });
    const callback = await run("kernel_code", { code: [
      'result = gateway.terminal_read(name="main")',
      'assert isinstance(result, dict)',
      `assert result["command_id"] == ${JSON.stringify(folded.command_id)}`,
      'assert result["status"] == "done"',
      'assert "×1000" in result["output"]',
      'toggled = gateway.terminal_set(name="main", quiet_notify=False)',
      'assert toggled == {"name": "main", "quiet_notify": False, "output_brake": True}',
      'inventory = gateway.terminal_list()["terminals"]',
      'assert any(t["name"] == "code-human" and t["owner"] == "human" and t["integration"] == "ready" for t in inventory)',
      'human = gateway.terminal_textsend(name="code-human", text="printf CODE_HUMAN", yield_s=2)',
      'assert human["status"] == "done" and human["exit_code"] == 0 and "CODE_HUMAN" in human["output"]',
      'assert gateway.terminal_read(name="code-human", raw=True)["integration"] == "ready"',
      'assert gateway.terminal_keysend(name="code-human", keys="C-l", yield_s=0)["name"] == "code-human"',
      'assert gateway.terminal_set(name="code-human", quiet_notify=False)["quiet_notify"] is False',
      'print("TERMINAL_CALLBACK_OK")',
    ].join("\n"), title: "Read, list and configure real model and human terminals through code callbacks" });
    assert.match(text(callback), /TERMINAL_CALLBACK_OK/);
    assert(callback.details.callbacks.some((entry) => entry.name === "terminal_read" && entry.status === "ok"));
    assert(callback.details.callbacks.some((entry) => entry.name === "terminal_set" && entry.status === "ok"));
    assert(callback.details.callbacks.some((entry) => entry.name === "terminal_list" && entry.status === "ok"));
    await client.request("terminalClose", { sessionId: worker, name: "code-human" });
    assert.equal((await client.request("nativeAction", { sessionId: worker, requestId: "terminal-direct-mode", action: "tool-mode", args: { mode: "direct" } })).status, "completed");

    await checkModelTerminalBrowser({ sessionId: worker, socket, onCleanup, call });
    await run("terminal_close", { name: "main" });
    const retainedPage = await call("terminal_read", { command: sequenceResult.command_id, offset: 0 });
    assert.equal(retainedPage.output, Buffer.from(full).subarray(0, 2048).toString("utf8"));
    assert(!(await client.request("terminalsList", { sessionId: worker })).terminals.some(({ name }) => name === "main"));
    assert(issued.includes("terminal_textsend") && issued.includes("terminal_read") && issued.includes("terminal_set") && issued.includes("terminal_close") && issued.includes("kernel_code"));
    console.log("PASS model terminals: real SDK-issued direct/code tools, complete 5000-line paging, idle quiet/done wakes with automatic y, hard timeout, restart, repeat folding, raw screen, API/Vite model-tab and event hooks; faux provider only");
  });
} finally { await rm(root, { recursive: true, force: true }); }
