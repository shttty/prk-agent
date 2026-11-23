import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { DERIVED_SESSION_TYPE } from "../../src/plugins/sessions/derivation-protocol.ts";
import { readDerivedSession } from "../../src/sessions/derivation/read-derived-session.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parsePeerMessages } from "../../shared/session-messages/parse-peer-messages.js";
import { readSessionEntries } from "./session-messaging/read-session-entries.mjs";
if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) {
  throw new Error("check-conversation-responsibility requires the owned Jupyter fixture; unset JUPYTER_URL and JUPYTER_TOKEN.");
}

const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");

await withTargetFixture(async ({ config, onCleanup, owned }) => {
  assert.equal(owned, true, "The responsibility check must use an owned Jupyter fixture.");
  const root = await mkdtemp(join(tmpdir(), "pi-conversation-responsibility-"));
  const historyDir = join(root, "history");
  let host;
  onCleanup(async () => { await host?.close(); await rm(root, { recursive: true, force: true }); });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "responsibility-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
  modelRuntime.registerNativeProvider(provider.provider);
  provider.setResponses(Array.from({ length: 200 }, () => async (context) => {
    const last = context.messages.at(-1);
    const command = last?.role === "user" ? /^TOOL (\{.*\})$/s.exec(text(last)) : null;
    if (!command) return fauxAssistantMessage("No implicit completion or acknowledgment.");
    const { tool, args } = JSON.parse(command[1]);
    return fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" });
  }));
  const model = "responsibility-check/controlled";
  const scopedManager = SessionManager.inMemory(root);
  const scopedSessionId = scopedManager.getSessionId();
  scopedManager.appendCustomEntry("gateway-session-binding", { version: 4, target: "local", cwd: root, sessionId: scopedSessionId });
  const scopedState = { createdBy: "scoped-parent", owner: "scoped-parent", taskId: "scoped-task", task: "scoped task", lifecycle: "persistent", phase: "working", model, thinkingLevel: "off" };
  scopedManager.appendCustomEntry(DERIVED_SESSION_TYPE, { ...scopedState, taskId: "scoped-matching", sessionId: scopedSessionId });
  scopedManager.appendCustomEntry(DERIVED_SESSION_TYPE, { ...scopedState, taskId: "scoped-foreign", sessionId: "foreign-session" });
  assert.equal(readDerivedSession(scopedManager)?.taskId, "scoped-matching", "Only matching-session task metadata retains authority");
  const options = { cwd: root, home: root, historyDir, model, thinkingLevel: "off", targets: [
    executionTargetFromConfig({ ...config, id: "other-default", label: "Other default", tags: [], cwd: root }),
    executionTargetFromConfig({ ...config, id: "local", label: "Owned fixture", tags: [], cwd: root }),
  ] };
  const dependencies = { runtimeDependencies: { model: provider.getModel("controlled"), modelRuntime, thinkingLevel: "off", cwd: root, agentDir: root } };
  host = await createGatewayHost(options, dependencies);
  const get = (name) => host.workbench().sessions.find((worker) => worker.sessionId === name);
  const idle = async (name) => {
    const deadline = Date.now() + 30000;
    while (host.session(name).getSnapshot().operation) {
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${name}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  let counter = 0;
  async function call(name, tool, args, expectedError) {
    name = name;
    await idle(name);
    const start = host.session(name).getSnapshot().messages.length;
    const admission = await host.session(name).submit({ requestId: `responsibility-${++counter}`, message: `TOOL ${JSON.stringify({ tool, args })}` });
    assert(admission.accepted, JSON.stringify(admission));
    assert.equal((await admission.completion).status, "completed");
    const result = host.session(name).getSnapshot().messages.slice(start).findLast((message) => message.role === "toolResult" && message.toolName === tool);
    assert(result, `${tool} must execute through the SDK`);
    if (expectedError) { assert.equal(result.isError, true); assert.match(text(result), expectedError); return; }
    assert(!result.isError, text(result));
    return JSON.parse(text(result));
  }
  async function lifecycle(name, action, args = {}) {
    name = name;
    if (get(name)?.state !== "closed") await idle(name);
    const result = await host.nativeAction(name, { sessionId: name, requestId: `lifecycle-${++counter}`, action, args });
    assert.equal(result.status, "completed", JSON.stringify(result));
    return result.data;
  }
  await prepareGatewayEnvironment(host, root, "local");
  const owner = (await host.createSession({ target: "local", label: "Owner" })).session.sessionId;
  const receiver = (await host.createSession({ target: "local", label: "Receiver" })).session.sessionId;
  const child = (await call(owner, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Retain responsibility", label: "Retained responsibility", lifecycle: "persistent", target: "local" }] })).children[0].sessionId;
  await idle(child);
  const originalSessionId = get(child).sessionId;
  const original = structuredClone(get(child).derivation);
  const running = await host.session(child).submit({ requestId: "new-while-running", message: `TOOL ${JSON.stringify({ tool: "kernel_code", args: { code: "import time\ntime.sleep(0.2)" } })}` });
  assert.equal(running.accepted, true);
  const runningCount = host.workbench().sessions.length;
  const busyNew = await host.nativeSend(child, { sessionId: child, requestId: "busy-new", message: "/new", mode: "auto" });
  assert.equal(busyNew.status, "unavailable");
  assert.equal(host.workbench().sessions.length, runningCount);
  assert.equal(get(child).sessionId, originalSessionId);
  assert.equal((await running.completion).status, "completed");
  const opened = await lifecycle(child, "new");
  assert.equal(opened.session.target, get(child).target, "New uses the source target, not the configured first target");
  assert.equal(opened.session.cwd, get(child).cwd);
  await host.closeSession(opened.session.sessionId);
  const closedBefore = host.state(opened.session.sessionId);
  const closedCount = host.workbench().sessions.length;
  const closedNew = await host.nativeSend(opened.session.sessionId, { sessionId: opened.session.sessionId, requestId: "closed-new", message: "/new", mode: "auto" });
  assert.equal(closedNew.status, "completed", JSON.stringify(closedNew));
  assert.equal(closedNew.data.snapshot.state, "idle");
  assert.deepEqual(host.state(opened.session.sessionId), closedBefore, "Closed source is not recovered to evaluate /new");
  assert.equal(host.workbench().sessions.length, closedCount + 1);
  assert.notEqual(opened.session.sessionId, get(child).sessionId, "New opens an independent managed identity");
  assert.notEqual(opened.session.sessionId, originalSessionId);
  assert.equal(opened.session.derivation, undefined, "New does not inherit management responsibility");
  assert.deepEqual(get(child).derivation, original, "Original task retains its owner and cleanup rights");
  await call(owner, "session_manage", { action: "transfer", child, to: get(receiver).sessionId });
  await call(receiver, "session_manage", { action: "accept", child });
  await call(owner, "session_manage", { action: "destroy", child }, /control.*(?:parent|ancestor|root|supervisor)/i);
  const result = await call(child, "session_result", { summary: "Durable result", artifacts: ["result.txt"] });
  await idle(receiver);
  const submitted = structuredClone(get(child).derivation);
  await lifecycle(child, "new");
  assert.deepEqual(get(child).derivation, submitted, "Submitted result and actual owner survive new");
  await call(child, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Forbidden after submission", label: "Forbidden submitted spawn" }] }, /already submitted/);
  await lifecycle(receiver, "new");
  await assert.rejects(host.closeSession(receiver), /Owned children/);
  assert.notEqual(get(receiver).state, "closed", "A retained creator child still blocks its owner's close");
  assert.deepEqual(get(child).derivation, submitted, "Rejected owner close neither clears delivery nor transfers its creator child");
  assert.notEqual(get(child).state, "closed", "Rejected owner close leaves the retained creator child's runtime intact");
  assert.equal(get(child).derivation.phase, "delivered", "Creator results reach final delivery without acknowledgment");
  const delivered = structuredClone(get(child).derivation);

  // A cloned worker's copied receipt is history, not authority for this recipient.
  // An already-delivered result is not replayed on explicit ownership transfer.
  const receiptChild = (await call(owner, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "Receipt transfer regression", label: "Receipt transfer", lifecycle: "persistent", target: "local" }] })).children[0].sessionId;
  await idle(receiptChild);
  const receiptResult = await call(receiptChild, "session_result", { summary: "Receipt must follow transfer", artifacts: [] });
  await idle(owner);
  const cloned = await lifecycle(owner, "clone");
  const cloneName = cloned.session.sessionId;
  assert.equal(get(cloneName).state, "idle", "Cloning starts its own runtime");
  assert.equal(cloned.pythonMemoryCopied, false, "Cloning does not copy the source kernel");
  await call(owner, "session_manage", { action: "transfer", child: receiptChild, to: get(cloneName).sessionId });
  const beforeTransferMessages = host.session(cloneName).getSnapshot().messages.length;
  await call(cloneName, "session_manage", { action: "accept", child: receiptChild });
  await idle(cloneName);
  assert.equal(get(receiptChild).derivation.owner, cloneName);
  const transferredMessages = host.session(cloneName).getSnapshot().messages.slice(beforeTransferMessages).flatMap((message) => parsePeerMessages(text(message)) ?? []);
  assert(!transferredMessages.some(({ body }) => body.includes(receiptResult.resultId)), "Transferring an already-delivered task does not replay its result");
  const nextChild = (await call(owner, "session_spawn", { context: "Submit only after directed ownership transfer is accepted.", tasks: [{ task: "New-owner receipt regression", label: "New-owner receipt", lifecycle: "persistent", target: "local" }] })).children[0];
  await idle(nextChild.sessionId);
  await call(owner, "session_manage", { action: "transfer", child: nextChild.sessionId, to: cloned.session.sessionId });
  await call(cloneName, "session_manage", { action: "accept", child: nextChild.sessionId });
  const beforeResult = host.session(cloneName).getSnapshot().messages.length;
  const nextResult = await call(nextChild.sessionId, "session_result", { summary: "New result follows its accepted owner", artifacts: [] });
  await idle(cloneName);
  const received = host.session(cloneName).getSnapshot().messages.slice(beforeResult).flatMap((message) => parsePeerMessages(text(message)) ?? []);
  assert.equal(received.filter(({ body }) => body.includes(nextResult.resultId) && body.includes(nextChild.sessionId)).length, 1, "The clone receives its new child's result exactly once despite copied history");
  const receipts = (await readSessionEntries(root, historyDir, cloned.session.sessionId)).filter((entry) => entry.type === "custom" && entry.customType === "gateway-derived-receipt" && entry.data.sessionId === cloned.session.sessionId && entry.data.child === nextChild.sessionId && entry.data.taskId === nextChild.taskId && entry.data.result.id === nextResult.resultId);
  assert.equal(receipts.length, 1, "The clone owns a new exact native receipt, not its copied foreign-subject receipt");

  await host.close();
  host = await createGatewayHost(options, dependencies);
  assert.deepEqual(get(child).derivation, delivered, "Restart retains final responsibility on the original identity");
  assert.equal(get(child).derivation.owner, receiver);
  assert.equal(get(child).state, "sleeping");
  const sleepingBefore = host.state(child);
  const sleepingCount = host.workbench().sessions.length;
  const sleepingNew = await host.nativeSend(child, { sessionId: child, requestId: "sleeping-new", message: "/new", mode: "auto" });
  assert.equal(sleepingNew.status, "completed", JSON.stringify(sleepingNew));
  assert.equal(sleepingNew.data.snapshot.state, "idle");
  assert.deepEqual(host.state(child), sleepingBefore, "Sleeping source is not awakened to evaluate /new");
  assert.equal(host.workbench().sessions.length, sleepingCount + 1);
  console.log("PASS: real SDK/Jupyter derived responsibility, transfer, clone-scoped receipt, subject-scoped projection, result and cleanup survive independent new/restart; controlled provider only");
});
