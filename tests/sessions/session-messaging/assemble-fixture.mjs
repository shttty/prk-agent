import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentTools, getCurrentSystemPrompt } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../../src/gateway/socket-client/connect-client.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { parsePeerMessages } from "../../../shared/session-messages/parse-peer-messages.js";
import { waitForSessionCondition } from "../derivation/wait-for-session-condition.mjs";
import { readSessionEntries } from "./read-session-entries.mjs";
import { readTaskReceipt } from "./read-task-receipt.mjs";

export async function assembleFixture({ home, config, onCleanup, prepareHistory }) {
  const agentDir = join(home, "agent"), historyDir = join(home, "history");
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { enabled: false }, retry: { enabled: false }, steeringMode: "all", followUpMode: "all" }));
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "session-messaging-check", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const requests = [], releases = new Set();
  const text = (message) => typeof message?.content === "string" ? message.content : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
  provider.setResponses(Array.from({ length: 800 }, () => (context) => {
    const last = context.messages.at(-1), body = text(last);
    requests.push({ tools: getCurrentTools(context.messages), prompt: getCurrentSystemPrompt(context.messages), messages: structuredClone(context.messages) });
    if (last?.role === "toolResult") return fauxAssistantMessage("Tool result observed.");
    if (last?.role === "user" && body.startsWith("OBSERVE_TEXT ")) return fauxAssistantMessage(`OBSERVED_${body.slice(13)}`);
    const command = /^SESSION_TOOL (\{.*\})$/s.exec(body);
    if (command) {
      const { tool, args } = JSON.parse(command[1]);
      return fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" });
    }
    return fauxAssistantMessage(parsePeerMessages(body) ? "Merged session input consumed." : "Session task admitted.");
  }));
  const document = { session: { workerTools: "direct", idleTimeoutMs: 60000,
    capabilities: { "lazy:tool:session_list": true, "lazy:tool:session_manage": true } }, memory: { review: false } };
  await writeFile(join(home, "config.toml"), stringify(document));
  const legacy = await prepareHistory?.({ home, historyDir });
  const host = await createGatewayHost({ cwd: home, home, historyDir, model: "session-messaging-check/controlled", config: parsePrkConfig(document), targets: [
    executionTargetFromConfig({ ...config, id: "local", label: "local", local: true, cwd: home }),
    executionTargetFromConfig({ ...config, id: "remote", label: "remote", local: false, sshCommand: "/bin/sh", cwd: home }),
  ] }, { runtimeDependencies: { cwd: home, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off" } });
  const endpoint = await startGateway(host, join(home, "gateway.sock"));
  const client = await connectGateway(join(home, "gateway.sock"));
  onCleanup(async () => {
    for (const path of releases) await writeFile(path, "release");
    await client.disconnect();
    await endpoint.close();
  });
  for (const target of ["local", "remote"]) await prepareGatewayEnvironment(host, home, target);
  const get = (name) => host.workbench().sessions.find((entry) => entry.sessionId === name);
  const idle = (name) => waitForSessionCondition(() => !get(name) || !host.state(get(name).sessionId).operation, `session idle ${name}`);
  const submit = async (name, tool, args) => {
    await idle(name);
    const runtime = host.session(name), start = runtime.getSnapshot().messages.length;
    const hidden = ["session_list", "session_manage"].includes(tool);
    const declared = hidden ? "tool_call" : tool;
    const admission = await runtime.submit({ requestId: randomUUID(), message: `SESSION_TOOL ${JSON.stringify({ tool: declared, args: hidden ? { name: tool, args } : args })}` });
    assert.equal(admission.accepted, true, JSON.stringify(admission));
    return { runtime, start, declared, ...admission };
  };
  const call = async (name, tool, args = {}, expectedError) => {
    const current = get(name);
    const task = tool === "session_result" && !expectedError && current?.derivation?.lifecycle === "temporary" ? { name, sessionId: current.sessionId, taskId: current.derivation.taskId, recipientSessionId: get(current.derivation.owner).sessionId } : undefined;
    let execution;
    const subscription = host.session(name).subscribe((event) => {
      if (event.type === "session_event" && event.details?.sdkType === "tool_execution_end") execution = event.details;
    });
    let run;
    try { run = await submit(name, tool, args); await run.completion; }
    finally { subscription.unsubscribe(); }
    const outcome = await run.completion;
    assert.equal(outcome.status, "completed", JSON.stringify(outcome));
    const snapshot = run.runtime.getSnapshot();
    const projected = snapshot.messages.slice(run.start).findLast((message) => message.role === "toolResult" && message.toolName === run.declared);
    const result = projected?.outputPreview ? host.toolContent(name, projected.toolCallId).result : projected;
    if (task) return readTaskReceipt({ cwd: current.cwd, recipientCwd: get(current.derivation.owner).cwd, directory: historyDir, task, params: args, outcome, toolResult: result });
    assert(result, `${tool} executed through the native SDK`);
    assert.equal(Boolean(result.isError), Boolean(expectedError), text(result));
    if (expectedError) { assert.match(text(result), expectedError); return result; }
    return tool === "kernel_code" ? result : execution?.result.structuredContent ?? JSON.parse(text(result));
  };
  const create = async (label, target = "local") => (await client.request("createSession", { target, label })).session.sessionId;
  const spawn = async (owner, task, lifecycle = "persistent") => {
    const child = (await call(owner, "session_spawn", { context: "Session messaging acceptance: retain explicit task identity and submit only when instructed.", tasks: [{ task, label: task, lifecycle }] })).children[0];
    assert.equal(child.sessionName, task);
    assert.deepEqual(Object.keys(child).sort(), ["index", "sessionId", "sessionName", "taskId"]);
    await idle(child.sessionId);
    return child;
  };
  const peers = (name, start = 0) => host.state(get(name).sessionId).messages.slice(start).filter((entry) => entry.role === "user").flatMap((entry) => parsePeerMessages(text(entry)) ?? []);
  const entries = (sessionId) => readSessionEntries(home, historyDir, sessionId);
  const hold = async (name) => {
    const release = join(home, `release-${randomUUID()}`);
    releases.add(release);
    const run = await submit(name, "kernel_code", { code: `from pathlib import Path\nimport time\ndeadline = time.monotonic() + 30\nwhile not Path(${JSON.stringify(release)}).exists() and time.monotonic() < deadline:\n    time.sleep(0.02)\nassert Path(${JSON.stringify(release)}).exists(), 'acceptance barrier timeout'` });
    await waitForSessionCondition(() => host.state(name).execution?.status === "running" || host.state(name).messages.slice(run.start).some((message) => message.role === "assistant" && message.content?.some((part) => part.type === "toolCall" && part.name === "kernel_code")), "native kernel tool starts");
    return { ...run, release: async () => { await writeFile(release, "release"); releases.delete(release); assert.equal((await run.completion).status, "completed"); await idle(name); } };
  };
  return { host, client, home, historyDir, modelRuntime, legacy, requests, text, get, idle, submit, call, create, spawn, peers, entries, hold };
}
