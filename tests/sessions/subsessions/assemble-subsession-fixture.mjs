import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../../src/gateway/socket-client/connect-client.ts";
import { connectWebGateway } from "../../../src/http/gateway-connection/connect-gateway.ts";
import { startWebServer } from "../../../src/http/listener/start-listener.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";
import { waitForSessionCondition } from "../derivation/wait-for-session-condition.mjs";
import { readSessionEntries } from "../session-messaging/read-session-entries.mjs";

export async function assembleSubsessionFixture({ home, agentDir, config, tempRoot, onCleanup }) {
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false } }));
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "subsession-check", models: ["parent", "task", "role", "explicit"].map((id) => ({ id, reasoning: true })), tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const text = (message) => typeof message?.content === "string" ? message.content
    : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const requests = [];
  provider.setResponses(Array.from({ length: 800 }, () => (context, options, _state, model) => {
    requests.push({ model: model.id, thinkingLevel: options?.reasoning, tools: getCurrentTools(context.messages),
      prompt: getCurrentSystemPrompt(context.messages), messages: structuredClone(context.messages) });
    const last = context.messages.at(-1);
    const command = last?.role === "user" ? /^SUBSESSION_TOOL (\{.*\})$/s.exec(text(last)) : null;
    if (command) {
      const { tool, args } = JSON.parse(command[1]);
      return fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" });
    }
    return fauxAssistantMessage("Controlled task observed; no implicit tools or result submission.");
  }));
  const document = { session: { workerTools: "direct", localTools: true, noSkills: true, noContextFiles: true, idleTimeoutMs: 60000,
    capabilities: { "lazy:tool:session_list": true, "lazy:tool:session_manage": true, "lazy:tool:space_status": true } },
    memory: { review: false }, monitor: { enabled: false } };
  await writeFile(join(home, "config.toml"), stringify(document));
  const historyDir = join(home, "sessions"), socket = join(home, "gateway.sock");
  const host = await createGatewayHost({ home, cwd: tempRoot, historyDir, config: parsePrkConfig(document), model: "subsession-check/parent", targets: [
    executionTargetFromConfig({ ...config, id: "local", label: "local", local: true, cwd: tempRoot }),
    executionTargetFromConfig({ ...config, id: "remote", label: "remote", local: false, sshCommand: "/bin/sh", cwd: tempRoot }),
  ] }, { runtimeDependencies: { cwd: tempRoot, agentDir, modelRuntime, model: provider.getModel("parent"), thinkingLevel: "off" } });
  const endpoint = await startGateway(host, socket);
  const client = await connectGateway(socket);
  const adapter = await connectWebGateway({ socket });
  const web = await startWebServer(adapter, { host: "127.0.0.1", port: 0 });
  onCleanup(async () => { await web.close(); await adapter.close(); await client.disconnect(); await endpoint.close(); });
  for (const target of ["local", "remote"]) await prepareGatewayEnvironment(host, home, target);
  const get = (name) => host.workbench().sessions.find((entry) => entry.sessionId === name);
  const idle = (name) => waitForSessionCondition(() => !get(name) || !host.state(get(name).sessionId).operation, `subsession idle ${name}`);
  const call = async (name, tool, args = {}, expectedError) => {
    await idle(name);
    const runtime = host.session(name), start = runtime.getSnapshot().messages.length;
    const codeMode = tool !== "kernel_code" && (await client.request("nativeCapabilities", { sessionId: name })).target.current.toolMode === "code";
    const hidden = ["space_status", "session_manage", "session_list"].includes(tool);
    const declared = codeMode ? "kernel_code" : hidden ? "tool_call" : tool;
    const parameters = codeMode ? { code: `import json\nprint('SUBSESSION_REPLY=' + json.dumps(gateway.call(${JSON.stringify(tool)}, json.loads(${JSON.stringify(JSON.stringify(args))}))))` }
      : hidden ? { name: tool, args } : args;
    const operation = await runtime.submit({ requestId: randomUUID(), message: `SUBSESSION_TOOL ${JSON.stringify({ tool: declared, args: parameters })}` });
    assert.equal(operation.accepted, true, JSON.stringify(operation));
    const outcome = await operation.completion;
    assert.equal(outcome.status, "completed", JSON.stringify(outcome));
    const snapshot = runtime.getSnapshot();
    const projected = snapshot.messages.slice(start).findLast((entry) => entry.role === "toolResult" && entry.toolName === declared);
    const result = projected?.outputPreview ? (await client.request("toolContent", { sessionId: name, toolCallId: projected.toolCallId })).result : projected;
    assert(result, `${tool} executes through the real SDK`);
    assert.equal(Boolean(result.isError), Boolean(expectedError), text(result));
    if (expectedError) { if (expectedError instanceof RegExp) assert.match(text(result), expectedError); return result; }
    if (codeMode) return JSON.parse(/^SUBSESSION_REPLY=(.*)$/mu.exec(text(result))?.[1] ?? "null");
    return ["kernel_code", "bash", "write", "read"].includes(tool) ? result : JSON.parse(text(result));
  };
  const create = async (label, cwd = tempRoot, target = "local") => (await client.request("createSession", { target, cwd, label })).session.sessionId;
  const spawn = async (owner, task) => {
    const result = await call(owner, "session_spawn", { context: "Subsession acceptance: complete only the assigned controlled task; await explicit instructions before submitting.",
      tasks: [{ task: `SUBSESSION_${task.label}`, lifecycle: "persistent", ...task }] });
    assert.deepEqual(result.errors, []);
    assert.equal(result.children.length, 1);
    assert.equal(result.children[0].sessionName, task.label);
    await idle(result.children[0].sessionId);
    return result.children[0].sessionId;
  };
  const saveDerivation = async (derivation) => {
    const response = await fetch(`${web.url}/api/derivation`, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify({ derivation }) });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const firstRequest = (label) => {
    const request = requests.find((entry) => entry.messages.some((message) => message.role === "user" && !text(message).startsWith("SUBSESSION_TOOL ") && text(message).includes(`SUBSESSION_${label}`)));
    assert(request, `The actual child ${label} reaches the controlled provider`);
    return request;
  };
  const peers = (name) => host.state(get(name).sessionId).messages.filter((entry) => entry.role === "user").flatMap((entry) => parsePeerMessages(text(entry)) ?? []);
  const entries = (name) => readSessionEntries(get(name).cwd, historyDir, get(name).sessionId);
  return { home, tempRoot, document, host, client, web, text, requests, get, idle, call, create, spawn, saveDerivation, firstRequest, peers, entries };
}
