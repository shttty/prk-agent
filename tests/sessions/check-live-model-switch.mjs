import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { checkBrowserSettings } from "./live-model-switch/check-browser-settings.mjs";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

const home = await mkdtemp(join(tmpdir(), "prk-live-model-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { ModelRuntime, SessionManager } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { createNativeInteractionService } = await import("../../src/sessions/native-interaction/assemble-native-interaction.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const text = (message) => typeof message.content === "string" ? message.content : message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
async function until(check, label) {
  const deadline = Date.now() + 20_000;
  while (!await check()) {
    assert(Date.now() < deadline, `Timed out: ${label}`);
    await new Promise((done) => setTimeout(done, 25));
  }
}
try {
  await withTargetFixture(async ({ config, onCleanup }) => {
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "live-model", models: [{ id: "primary", reasoning: true }, { id: "alternate", reasoning: true }], tokensPerSecond: 10_000 });
    runtime.registerNativeProvider(provider.provider);
    const requests = [];
    const gates = new Map();
    provider.setResponses(Array.from({ length: 100 }, () => (context, options, _state, model) => {
      const prompt = text(context.messages.findLast((message) => message.role === "user"));
      requests.push({ prompt, model: model.id, reasoning: options?.reasoning });
      if (context.messages.findLast((message) => message.role !== "system")?.role === "toolResult") return fauxAssistantMessage("R2_FINAL_REPLY");
      const release = gates.get(prompt);
      if (!release) return fauxAssistantMessage(`R2_REPLY_${prompt}`);
      return fauxAssistantMessage(fauxToolCall("kernel_code", { code: `from pathlib import Path\nimport time\ndeadline = time.monotonic() + 30\nwhile not Path(${JSON.stringify(release)}).exists():\n    if time.monotonic() > deadline: raise TimeoutError('release missing')\n    time.sleep(0.01)\nprint('R2_TOOL_RESULT')` }), { stopReason: "toolUse" });
    }));
    const options = { cwd: home, home, model: "live-model/primary", config: parsePrkConfig({ monitor: { enabled: false }, session: { idleTimeoutMs: 60_000 } }), targets: [
      executionTargetFromConfig({ ...config, id: "fixture", label: "Local fixture", local: true, tags: [], cwd: home }),
    ] };
    const dependencies = { runtimeDependencies: { model: provider.getModel("primary"), modelRuntime: runtime, thinkingLevel: "low", cwd: home, agentDir } };
    const socket = join(home, "gateway.sock");
    let host, gateway, client;
    async function start() {
      host = await createGatewayHost(options, dependencies);
      gateway = await startGateway(host, socket);
      client = await connectGateway(socket);
    }
    async function close() { await client?.disconnect(); await gateway?.close(); client = gateway = undefined; }
    onCleanup(close);
    await start();
    let sequence = 0;
    const action = (worker, name, args) => client.request("nativeAction", { sessionId: worker, requestId: `action-${++sequence}`, action: name, args });
    const current = async (worker) => (await client.request("nativeCapabilities", { sessionId: worker })).target.current;
    async function send(worker, message) {
      const accepted = await client.request("send", { sessionId: worker, requestId: `send-${++sequence}`, message });
      assert.equal(accepted.accepted, true);
      return accepted.operationId;
    }
    async function completed(worker, operationId) {
      await until(() => host.state(worker).recentOperations.some((operation) => operation.operationId === operationId && operation.status === "completed"), "operation completed");
      const snapshot = await client.request("state", { sessionId: worker });
      const failed = snapshot.messages.filter((message) => message.role === "toolResult" && message.isError);
      assert.deepEqual(failed, []);
      return snapshot;
    }
    const worker = (await client.request("createSession", { target: "fixture" })).session.sessionId;
    const prompt = "R2_SWITCH";
    const release = join(home, "backend-release");
    gates.set(prompt, release);
    const operationId = await send(worker, prompt);
    try {
      await until(() => host.state(worker).kernel?.state === "busy", "real kernel tool running");
      assert.equal(host.state(worker).state, "running");
      assert.deepEqual(requests, [{ prompt, model: "primary", reasoning: "low" }]);
      assert.equal((await action(worker, "model", { model: "live-model/alternate" })).status, "completed", "Model selection is allowed while busy");
      assert.equal((await action(worker, "thinking", { level: "high" })).status, "completed", "Thinking selection is allowed while busy");
      assert.equal((await action(worker, "settings", { autoRetry: false })).status, "unavailable", "Other idle-only actions remain refused");
      assert.deepEqual(requests, [{ prompt, model: "primary", reasoning: "low" }], "Changing settings does not rewrite or invoke the first provider request");
      assert.equal((await current(worker)).model, "live-model/alternate");
      assert.equal((await current(worker)).thinkingLevel, "high");
      assert.equal(host.state(worker).model, "live-model/alternate");
      assert.equal(host.state(worker).thinkingLevel, "high");
    } finally { await writeFile(release, "release"); }
    const finished = await completed(worker, operationId);
    assert.deepEqual(requests, [{ prompt, model: "primary", reasoning: "low" }, { prompt, model: "alternate", reasoning: "high" }], "The second request in the same reply uses the new settings");
    const messages = finished.messages.filter((message) => ["user", "assistant", "toolResult"].includes(message.role));
    assert.deepEqual(messages.map((message) => message.role), ["user", "assistant", "toolResult", "assistant"]);
    assert.deepEqual(messages.filter((message) => message.role === "assistant").map((message) => message.model), ["primary", "alternate"]);
    const exported = await action(worker, "export", { format: "jsonl" });
    assert.equal(exported.status, "completed");
    const entries = exported.data.content.trim().split("\n").map((line) => JSON.parse(line));
    const firstReply = entries.findIndex((entry) => entry.message?.role === "assistant");
    const changedModel = entries.findIndex((entry) => entry.type === "model_change" && entry.modelId === "alternate");
    const changedThinking = entries.findIndex((entry) => entry.type === "thinking_level_change" && entry.thinkingLevel === "high");
    const toolResult = entries.findIndex((entry) => entry.message?.role === "toolResult");
    assert(firstReply < changedModel && changedModel < changedThinking && changedThinking < toolResult, "Native changes are between the first response and its tool result");
    assert(entries.slice(changedModel, toolResult).some((entry) => entry.type === "custom" && entry.customType === "gateway-native-session-state"), "Session state records are interleaved without hiding messages");
    assert.equal((await action(worker, "reload", {})).status, "completed");
    assert.deepEqual((await client.request("state", { sessionId: worker })).messages, finished.messages, "SDK reload preserves the conversation projection");
    const lastReplyIndex = finished.messages.findLastIndex((message) => message.role === "assistant");
    const fork = await action(worker, "fork-reply", { entryId: finished.messageEntryIds[lastReplyIndex] });
    assert.equal(fork.status, "completed");
    assert.deepEqual(fork.data.snapshot.messages.filter((message) => ["user", "assistant", "toolResult"].includes(message.role)), messages, "Fork retains both sides of the live model change");
    assert.deepEqual((await client.request("state", { sessionId: worker })).messages, finished.messages, "Fork does not alter the original projection");
    const userIndex = finished.messages.findIndex((message) => message.role === "user");
    assert.equal((await action(worker, "tree", { entryId: finished.messageEntryIds[userIndex] })).status, "completed");
    const rerun = await completed(worker, await send(worker, "R2_RERUN"));
    assert.deepEqual(rerun.messages.filter((message) => message.role === "user").map(text), ["R2_RERUN"], "Rerun replaces the visible continuation, not the saved branch");
    assert(!rerun.messages.some((message) => message.role === "toolResult"), "Old tool results do not leak into the rerun branch");
    await close();
    await start();
    const retained = fork.data.session.sessionId;
    assert.equal((await client.request("state", { sessionId: retained })).state, "sleeping");
    for (const [name, args] of [["model", { model: "live-model/primary" }], ["thinking", { level: "low" }]]) {
      assert.equal((await action(retained, name, args)).status, "completed", "Sleeping settings save without waking");
    }
    assert.equal((await client.request("state", { sessionId: retained })).state, "sleeping");
    await client.request("wakeSession", { sessionId: retained });
    assert.equal((await current(retained)).model, "live-model/primary");
    assert.equal((await current(retained)).thinkingLevel, "low");
    assert.deepEqual((await client.request("state", { sessionId: retained })).messages.filter((message) => ["user", "assistant", "toolResult"].includes(message.role)), messages, "Reopened native history retains the switched reply");
    await client.request("closeSession", { sessionId: retained });
    for (const [name, args] of [["model", { model: "live-model/primary" }], ["thinking", { level: "low" }]]) {
      assert.equal((await action(retained, name, args)).status, "unavailable", "Read-only closed history refuses changes");
      const manager = SessionManager.inMemory(home);
      const noSession = { sessionId: manager.getSessionId(), streamId: "missing-runtime-stream", state: "idle", readOnly: false, manager };
      const refused = await createNativeInteractionService().action(noSession, { sessionId: manager.getSessionId(), requestId: `missing-${name}`, action: name, args });
      assert.equal(refused.status, "unavailable", "No SDK session cannot mutate settings");
      assert.deepEqual(manager.getEntries(), [], "Refused settings leave history untouched");
    }
await checkBrowserSettings({ socket, onCleanup, client, home, gates, host, requests, current, completed, until });
    if (process.env.PI_TEST_WEB_EVIDENCE) {
      const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE);
      await mkdir(evidence, { recursive: true });
      await writeFile(join(evidence, "live-model-provider.json"), JSON.stringify({ requests, entryTypes: entries.map(({ type, modelId, thinkingLevel, customType, message }) => ({ type, modelId, thinkingLevel, customType, role: message?.role })) }, null, 2));
    }
    console.log("PASS live model/thinking: same-reply provider requests, original request unchanged, native entry ordering, reload/fork/rerun, reopened history, sleeping/read-only/missing-session boundaries; faux only");
  }, { allowHidden: true });
} finally { await rm(home, { recursive: true, force: true }); }
