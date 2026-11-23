import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";

const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");

async function until(check, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out: ${label}`);
}

export async function createFixture({ config, onCleanup }, session = {}) {
  const root = await mkdtemp(join(tmpdir(), "prk-session-delivery-"));
  let host;
  onCleanup(async () => { await host?.close(); await rm(root, { recursive: true, force: true }); });
  const runtime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const faux = fauxProvider({ provider: "session-delivery", models: [{ id: "test" }], tokensPerSecond: 100_000 });
  runtime.registerNativeProvider(faux.provider);
  faux.setResponses(Array.from({ length: 500 }, () => async (context) => {
    const last = context.messages.at(-1);
    const command = /^TOOL (\{.*\})$/s.exec(text(last));
    if (command) {
      const { tool, args } = JSON.parse(command[1]);
      return fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" });
    }
    const chainStart = context.messages.findLastIndex((message) => message.role === "user" && text(message) === "CHAIN");
    if (chainStart >= 0) {
      const tail = context.messages.slice(chainStart + 1);
      const finished = tail.some((message) => message.role === "assistant" && text(message) === "CHAIN_DONE");
      if (!finished) {
        const steps = tail.filter((message) => message.role === "toolResult" && message.toolName === "kernel_code").length;
        if (steps < 2) return fauxAssistantMessage(fauxToolCall("kernel_code", {
          code: `import time\nfrom pathlib import Path\nPath(${JSON.stringify(join(root, `chain-ready-${steps + 1}`))}).write_text('ready')\nwhile not Path(${JSON.stringify(join(root, `chain-release-${steps + 1}`))}).exists():\n    time.sleep(0.01)\nprint('CHAIN_STEP_${steps + 1}')`,
        }), { stopReason: "toolUse" });
        return fauxAssistantMessage("CHAIN_DONE");
      }
    }
    const peers = parsePeerMessages(text(last));
    return fauxAssistantMessage(peers ? `SEEN:${peers.map((message) => message.body).join("|")}` : "DONE");
  }));
  host = await createGatewayHost({
    cwd: root, home: root, historyDir: join(root, "history"), model: "session-delivery/test",
    config: parsePrkConfig({ session: { workerTools: "direct", capabilities: { "lazy:tool:session_list": false }, ...session } }),
    targets: [executionTargetFromConfig({ ...config, id: "local", label: "Local", local: true, cwd: root })],
  }, { runtimeDependencies: { model: faux.getModel("test"), modelRuntime: runtime, thinkingLevel: "off", cwd: root, agentDir: root } });
  const snapshot = (name) => host.session(name).getSnapshot();
  const idle = (name) => until(() => host.session(name).isIdle, `idle ${name}`);
  let counter = 0;
  const start = async (name, message) => {
    await idle(name);
    const offset = snapshot(name).messages.length;
    const admission = await host.session(name).submit({ requestId: `delivery-${++counter}`, message });
    assert(admission.accepted, JSON.stringify(admission));
    return { offset, admission, completion: admission.completion };
  };
  const call = async (name, tool, args) => {
    const run = await start(name, `TOOL ${JSON.stringify({ tool, args })}`);
    await run.completion;
    const result = snapshot(name).messages.slice(run.offset).find((message) => message.role === "toolResult" && message.toolName === tool);
    assert(result, `${tool} executed`);
    return { ...run, result, value: result.isError || tool === "kernel_code" ? undefined : JSON.parse(text(result)) };
  };
  await prepareGatewayEnvironment(host, root, "local");
  const owner = (await host.createSession({ target: "local", label: "Owner" })).session.sessionId;
  assert.equal(host.setSessionRoot({ sessionId: owner }).rootSessionId, snapshot(owner).sessionId);
  const spawn = async (label) => {
    const result = await call(owner, "session_spawn", { context: "Delivery integration test.", tasks: [{ task: label, label, lifecycle: "persistent", target: "local" }] });
    assert(!result.result.isError, text(result.result));
    assert.equal(result.value.children[0].sessionName, label);
    const child = host.workbench().sessions.find((entry) => entry.sessionId === result.value.children[0].sessionId).sessionId;
    await idle(child);
    return child;
  };
  return { root, host, owner, spawn, snapshot, idle, start, call, text, until, modelRuntime: runtime, nativeId: (name) => snapshot(name).sessionId };
}
