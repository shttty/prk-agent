import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentTools, getCurrentSystemMessage, getSystemMessageText } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";

const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");

await withTargetFixture(async ({ config }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-session-space-"));
  const cwd = join(root, "session-cwd");
  let host, gateway, client;
  try {
    await mkdir(cwd);
    await prepareNativeToolArtifacts(root);
    const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "worker-space-check", models: [{ id: "primary" }, { id: "alternate" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const contexts = [];
    provider.setResponses(Array.from({ length: 100 }, () => async (context) => {
      contexts.push(context);
      const last = context.messages.at(-1);
      if (last?.role === "toolResult") return fauxAssistantMessage("Tool completed; explicit state remains authoritative.");
      const command = /^TOOL (\{.*\})$/s.exec(text(last));
      if (command) {
        const { tool, args } = JSON.parse(command[1]);
        return fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" });
      }
      return fauxAssistantMessage("WORKER_REPLY");
    }));
    const options = {
      cwd: root, home: root, config: parsePrkConfig({ session: { workerTools: "direct", localTools: true,
        capabilities: { "lazy:tool:space_status": true, "lazy:tool:session_list": true, "lazy:tool:session_manage": true } } }),
      historyDir: join(root, "history"), model: "worker-space-check/primary",
      targets: [executionTargetFromConfig({ ...config, id: "local", label: "Local", cwd })],
    };
    const dependencies = { runtimeDependencies: { model: provider.getModel("primary"), modelRuntime, thinkingLevel: "off", cwd: root, agentDir: root } };
    const start = () => createGatewayHost(options, dependencies);
    const socket = join(root, "gateway.sock");
    host = await start();
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    assert.deepEqual(host.workbench().sessions, []);
    await prepareGatewayEnvironment(host, root, "local");
    const created = await client.request("createSession", { target: "local", label: "Coordinator" });
    const name = created.session.sessionId;
    assert.equal(created.session.target, "local");
    assert.equal(Object.hasOwn(created.session, "kernelName"), false);
    assert.ok(created.snapshot.kernel, "Every session owns its kernel observation and lazy execution binding");
    const conversation = await host.session(name).submit({ requestId: "conversation", message: "Hello from an independent worker." });
    assert.equal(conversation.accepted, true);
    assert.equal((await conversation.completion).status, "completed");
    assert(host.state(name).messages.some((message) => text(message).includes("WORKER_REPLY")));
    const exposed = new Set(getCurrentTools(contexts.at(-1).messages).map((tool) => tool.name));
    for (const tool of ["kernel_code", "session_spawn", "session_send", "session_result", "tool_search", "tool_call"]) assert(exposed.has(tool), `Direct mode declares resident/meta ${tool}`);
    const prompt = getSystemMessageText(getCurrentSystemMessage(contexts.at(-1).messages));
    for (const tool of ["space_status", "session_list", "session_manage"]) {
      assert(!exposed.has(tool), `Direct mode hides lazy ${tool}`);
      assert(prompt.includes(`${tool}:`), `Lazy ${tool} remains discoverable in the capability inventory`);
    }
    const nativeNames = ["read", "bash", "edit", "write", "grep", "find", "ls"];
    for (const tool of nativeNames) assert(exposed.has(tool), `Enabled local tools declare native ${tool}`);
    for (const tool of ["python", "web_search", "powershell"]) assert(!exposed.has(tool));
    let counter = 0;
    const action = async (worker, kind, args) => {
      const result = await client.request("nativeAction", { sessionId: worker, requestId: `action-${++counter}`, action: kind, args });
      assert.equal(result.status, "completed", JSON.stringify(result));
      return result;
    };
    const call = async (tool, args) => {
      const startIndex = host.state(name).messages.length;
      const operation = await host.session(name).submit({ requestId: `native-${++counter}`, message: `TOOL ${JSON.stringify({ tool, args })}` });
      assert.equal((await operation.completion).status, "completed");
      const result = host.state(name).messages.slice(startIndex).findLast((message) => message.role === "toolResult" && message.toolName === tool);
      assert(result && !result.isError, text(result));
      return text(result);
    };
    await call("write", { path: "native-proof.txt", content: "native-before\n" });
    assert.equal(await readFile(join(cwd, "native-proof.txt"), "utf8"), "native-before\n");
    assert.match(await call("read", { path: "native-proof.txt" }), /native-before/);
    await call("edit", { path: "native-proof.txt", edits: [{ oldText: "native-before", newText: "native-after" }] });
    assert.equal(await readFile(join(cwd, "native-proof.txt"), "utf8"), "native-after\n");
    assert.equal((await call("bash", { command: "pwd" })).trim(), cwd);
    assert.match(await call("grep", { pattern: "native-after" }), /native-proof\.txt.*native-after/);
    assert.match(await call("find", { pattern: "*.txt" }), /native-proof\.txt/);
    assert.match(await call("ls", {}), /native-proof\.txt/);
    await client.request("assignProject", { sessionId: name, project: { id: "project-worker-space", name: "Worker project" } });
    await assert.rejects(client.request("assignProject", { sessionId: name, project: { id: "duplicate", name: "Worker project" } }), (error) => error.code === "INVALID_REQUEST");
    const second = await client.request("createSession", { target: "local", label: "Alternate coordinator" });
    assert.notEqual(second.session.sessionId, created.session.sessionId);
    await action(second.session.sessionId, "model", { model: "worker-space-check/alternate" });
    assert.equal(host.state(second.session.sessionId).model, "worker-space-check/alternate");
    const fresh = (await action(second.session.sessionId, "new", {})).data.session.sessionId;
    assert.equal(host.state(fresh).state, "idle", "Native /new starts its runtime instead of leaving read-only history");
    await action(fresh, "model", { model: "worker-space-check/primary" });
    assert.equal(host.state(fresh).model, "worker-space-check/primary", "A session from /new accepts /model before its first input");
    const missingModel = await client.request("nativeAction", { sessionId: name, requestId: "missing-model", action: "model", args: { model: "worker-space-check/missing" } });
    assert.equal(missingModel.status, "failed");
    const badThinking = await client.request("nativeAction", { sessionId: name, requestId: "bad-thinking", action: "thinking", args: { level: "impossible" } });
    assert.equal(badThinking.status, "failed");
    await assert.rejects(client.request("recoverSession", { sessionId: name, mode: "new", target: "local" }), (error) => error.code === "BUSY");
    await action(second.session.sessionId, "tool-mode", { mode: "direct" });
    assert.deepEqual((await action(second.session.sessionId, "local-tools", { enabled: false })).data, { localTools: false });
    assert.deepEqual(await client.request("closeSession", { sessionId: name }), { closed: true });
    const callsBeforeRestart = contexts.length;
    await client.disconnect(); client = undefined;
    await gateway.close(); gateway = undefined;
    options.config = parsePrkConfig({ session: { workerTools: "code",
      capabilities: { "lazy:tool:space_status": true, "lazy:tool:session_list": true, "lazy:tool:session_manage": true } } });
    host = await start();
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    const listed = (worker) => host.workbench().sessions.find((entry) => entry.sessionId === worker);
    assert.equal(listed(name).state, "closed", "Explicitly ended sessions stay closed after Gateway restart");
    assert.equal(listed(name).projectId, "project-worker-space");
    assert.equal(listed(second.session.sessionId).state, "sleeping", "Previously awake sessions restart asleep without replay");
    assert.equal(listed(second.session.sessionId).sessionId, second.session.sessionId);
    assert.equal(contexts.length, callsBeforeRestart);
    const resumed = await host.nativeSend(name, { sessionId: name, requestId: "ended-resumes", message: "Continue the ended worker", mode: "plain" });
    assert.equal(resumed.accepted, true);
    assert.equal((await resumed.completion).status, "completed");
    assert.equal(contexts.length, callsBeforeRestart + 1, "Only new input reaches the model");
    const direct = await host.nativeSend(second.session.sessionId, { sessionId: second.session.sessionId, requestId: "direct-resumes", message: "Inspect direct declarations", mode: "plain" });
    assert.equal((await direct.completion).status, "completed");
    const declared = new Set(getCurrentTools(contexts.at(-1).messages).map((tool) => tool.name));
    for (const tool of ["kernel_code", "session_spawn", "session_send", "session_result", "tool_search", "tool_call"]) assert(declared.has(tool));
    assert(!declared.has("space_status"));
    assert(getSystemMessageText(getCurrentSystemMessage(contexts.at(-1).messages)).includes("space_status:"));
    for (const tool of [...nativeNames, "python", "web_search"]) assert(!declared.has(tool), `Direct mode with local tools disabled excludes ${tool}`);
  } finally {
    await client?.disconnect();
    if (gateway) await gateway.close(); else await host?.close();
    await rm(root, { recursive: true, force: true });
  }
  console.log("PASS worker SDK sessions: kernels, local native tools/cwd, coordination, projects, model/thinking actions, persisted modes/local-tools switch and mixed closed/sleeping restart without replay");
});
