import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { parsePeerMessages } from "../../shared/session-messages/parse-peer-messages.js";
import { contentText } from "../../web/chat/conversation/content-text.js";

import { checkDuplexProtocol } from "./agent-duplex/check-protocol.mjs";
import { checkDuplexDispatch } from "./agent-duplex/check-dispatch.mjs";
import { checkDuplexCancellation } from "./agent-duplex/check-cancellation.mjs";
import { checkHandledInput } from "./agent-duplex/check-handled-input.mjs";
checkDuplexProtocol();

// Real Gateway/SDK/Jupyter paths below use a controlled provider, not a paid-model substitute.
const { mkdtemp, rm, mkdir, writeFile, access } = await import("node:fs/promises");
const { tmpdir } = await import("node:os");
const { join } = await import("node:path");
const { initializePrkHome } = await import("../../src/config/home/initialize-prk-home.ts");
const root = await mkdtemp(join(tmpdir(), "prk-agent-duplex-"));
const home = join(root, "home");
initializePrkHome(home);
// Queue modes come from Pi's own settings file in the PRK home (PRK no longer overrides them).
{
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(join(home, "agent"), { recursive: true });
  writeFileSync(join(home, "agent", "settings.json"), JSON.stringify({ steeringMode: "all", followUpMode: "all", compaction: { enabled: false } }));
}
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxAssistantMessage, fauxProvider, fauxToolCall } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const text = (message) => contentText(message?.content);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, description) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) { if (await check()) return; await sleep(20); }
  throw new Error(`Timed out: ${description}`);
}
const pause = (seconds) => ({ code: `import time\ntime.sleep(${seconds})\nprint('pause completed')` });
const exists = async (path) => { try { await access(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } };
const pythonStarted = join(root, "b3-python-started");
const reloadArm = join(root, "b3-reload-arm"), reloadMarker = join(root, "b3-reload-marker"), reloadRelease = join(root, "b3-reload-release");
const settleMarker = join(root, "b3-settle-marker"), settleRelease = join(root, "b3-settle-release");
try {
  await withTargetFixture(async ({ config, onCleanup }) => {
    let gateway;
    onCleanup(async () => { await gateway?.close(); });
    onCleanup(async () => { await Promise.all([reloadRelease, settleRelease].map((path) => writeFile(path, "release"))); });
    const modelRuntime = await ModelRuntime.create({ authPath: join(home, "agent", "auth.json"), modelsPath: null, refreshOnCreate: false });
    const faux = fauxProvider({ provider: "duplex-check", models: [{ id: "root" }], tokensPerSecond: 10000 });
    modelRuntime.registerNativeProvider(faux.provider);
    const modelCalls = [];
    faux.setResponses(Array.from({ length: 500 }, () => async (context) => {
      const last = context.messages.at(-1);
      const body = text(last);
      modelCalls.push({ role: last?.role, body, bodies: context.messages.map(text) });
      if (body === "MODE-INITIAL") await sleep(1000);
      if (last?.role === "toolResult") return fauxAssistantMessage("Tool completed.");
      const command = /^TOOL (\{.*\})$/s.exec(body);
      if (command) { const { tool, args } = JSON.parse(command[1]); return fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" }); }
      const commands = /^TOOLS (\[.*\])$/s.exec(body);
      if (commands) return fauxAssistantMessage(JSON.parse(commands[1]).map(({ tool, args }) => fauxToolCall(tool, args)), { stopReason: "toolUse" });
      const entries = parsePeerMessages(body);
      if (entries) {
        const question = entries.find((entry) => entry.body.includes("QUESTION-B"));
        if (question) return fauxAssistantMessage(fauxToolCall("session_send", { to: question.sender, message: "ANSWER-B: 17", replyTo: question.messageId }), { stopReason: "toolUse" });
        if (entries.some((entry) => entry.body === "PROCESSLONG-B3")) return fauxAssistantMessage(fauxToolCall("kernel_code", {
          code: `from pathlib import Path\nimport time\nPath(${JSON.stringify(pythonStarted)}).write_text('started')\ntime.sleep(120)`,
        }), { stopReason: "toolUse" });
        if (entries.some((entry) => /LONGWORK|PROCESSLONG/.test(entry.body))) return fauxAssistantMessage(fauxToolCall("kernel_code", pause(2)), { stopReason: "toolUse" });
        return fauxAssistantMessage(`PEER_ACK ${entries.length}`);
      }
      return fauxAssistantMessage("Task admitted.");
    }));
    const behavior = parsePrkConfig({ session: { workerTools: "direct", inboxMaxMessages: 3, inboxMaxChars: 256 } });
    const dependencies = { runtimeDependencies: { model: faux.getModel("root"), modelRuntime, thinkingLevel: "off", cwd: root, agentDir: join(home, "agent") } };
    gateway = await createGatewayHost({ cwd: root, home, config: behavior, historyDir: join(root, "history"), model: "duplex-check/root", targets: [executionTargetFromConfig({ ...config, id: "local", label: "Local", cwd: root })] }, dependencies);
    const snapshot = (name) => gateway.session(name).getSnapshot();
    const idle = (name) => until(() => !snapshot(name).operation, `idle ${name}`);
    let counter = 0;
    async function command(name, message) {
      await idle(name);
      const start = snapshot(name).messages.length;
      const admission = await gateway.session(name).submit({ requestId: `duplex-${++counter}`, message });
      assert(admission.accepted, JSON.stringify(admission));
      return { start, ...admission };
    }
    const call = (name, tool, args) => command(name, `TOOL ${JSON.stringify({ tool, args: tool === "session_send" ? { ...args, to: snapshot(args.to).sessionId } : args })}`);
    const toolResults = (name, tool, start) => snapshot(name).messages.slice(start).filter((message) => message.role === "toolResult" && message.toolName === tool);
    function receipt(name, start, tool = "session_send") {
      const result = toolResults(name, tool, start)[0];
      assert(result && !result.isError, text(result));
      return JSON.parse(text(result));
    }
    async function send(from, to, message, extra = {}) {
      const run = await call(from, "session_send", { to, message, ...extra });
      assert.equal((await run.completion).status, "completed");
      return receipt(from, run.start);
    }
    const peerUsers = (name, start = 0) => snapshot(name).messages.slice(start).filter((message) => message.role === "user" && parsePeerMessages(text(message)));
    const peers = (name, start = 0) => peerUsers(name, start).flatMap((message) => parsePeerMessages(text(message)));
    const executions = [];
    const inPython = (name, start) => until(() => executions.some((event) => event.name === name && event.tool === "kernel_code" && event.phase === "tool_execution_start" && event.messageIndex >= start), `${name} Python started`);
    const main = (await gateway.createSession({ target: "local", label: "Coordinator" })).session.sessionId;
    async function spawn(label) {
      const run = await call(main, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: `${label} task`, label, lifecycle: "persistent", target: "local" }] });
      assert.equal((await run.completion).status, "completed");
      const child = receipt(main, run.start, "session_spawn").children[0];
      assert.equal(child.sessionName, label);
      const name = gateway.workbench().sessions.find((entry) => entry.sessionId === child.sessionId).sessionId;
      await idle(name);
      gateway.session(name).subscribe((event) => {
        if (event.type === "session_event" && ["tool_execution_start", "tool_execution_end"].includes(event.details?.sdkType)) {
          executions.push({ name, tool: event.details.toolName, id: event.details.toolCallId, phase: event.details.sdkType, at: performance.now(), messageIndex: snapshot(name).messages.length });
        }
      });
      return name;
    }
    const { b, c, d, spans, backlog } = await checkDuplexDispatch({ spawn, call, inPython, send, snapshot, toolResults, peerUsers, peers, modelCalls, command, receipt, executions, idle, gateway, until, pause, main, text });

    const { notices, processLong, sdkPeer, inboxPeer, cancelled } = await checkDuplexCancellation({ snapshot, send, until, exists, pythonStarted, gateway, idle, peers, modelCalls, command, text, b, c, d });

    // Keep all preceding B2 checks on noExtensions=true. Restart only the isolated Gateway.
    await gateway.close();
    const extensionDir = join(home, "agent", "extensions");
    await mkdir(extensionDir, { recursive: true });
    await writeFile(join(extensionDir, "b3-boundaries.ts"), `
import { access, rm, writeFile } from "node:fs/promises";
const paths = ${JSON.stringify({ reloadArm, reloadMarker, reloadRelease, settleMarker, settleRelease })};
const exists = async (path) => { try { await access(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } };
async function hold(marker, release) {
  await writeFile(marker, "entered");
  const deadline = Date.now() + 120000;
  while (!(await exists(release))) {
    if (Date.now() >= deadline) throw new Error("Owned B3 extension release timed out");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
export default function (pi) {
  let initialPrompt = false;
  pi.on("before_agent_start", (event) => { initialPrompt = event.messageType === "user" && event.prompt === "B3-FALLBACK-INITIAL"; });
  pi.on("agent_before_settle", async (event) => {
    if (!initialPrompt || event.outcome !== "completed") return;
    initialPrompt = false;
    await hold(paths.settleMarker, paths.settleRelease);
  });
  pi.on("session_shutdown", async (event) => {
    if (event.reason !== "quit" || !(await exists(paths.reloadArm))) return;
    await rm(paths.reloadArm);
    await hold(paths.reloadMarker, paths.reloadRelease);
  });
}
`);
    const extensionBehavior = parsePrkConfig({ session: { workerTools: "direct", noExtensions: false, inboxMaxMessages: 3, inboxMaxChars: 256 } });
    gateway = await createGatewayHost({ cwd: root, home, config: extensionBehavior, historyDir: join(root, "b3-extension-history"), model: "duplex-check/root", targets: [executionTargetFromConfig({ ...config, id: "local", label: "Local", cwd: root })] }, dependencies);
    const sender = (await gateway.createSession({ target: "local", label: "B3 extension sender" })).session.sessionId;
    const spawnRun = await call(sender, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: "B3 extension recipient task", label: "B3 extension recipient", lifecycle: "persistent", target: "local" }] });
    assert.equal((await spawnRun.completion).status, "completed");
    const recipientId = receipt(sender, spawnRun.start, "session_spawn").children[0].sessionId;
    const recipient = gateway.workbench().sessions.find((entry) => entry.sessionId === recipientId).sessionId;
    await idle(recipient);
    const reloadStart = snapshot(recipient).messages.length;
    const previousStream = snapshot(recipient).streamId;
    await writeFile(reloadArm, "armed");
    const reload = gateway.session(recipient).reload();
    await until(() => exists(reloadMarker), "public session_shutdown holds the retiring runtime");
    // Capability reload rebuilds the SDK runtime; Gateway admission waits for that transition, not the old inbox.
    const duringReload = await call(sender, "session_send", { to: recipient, message: "B3-DURING-RELOAD" });
    await until(() => snapshot(sender).messages.slice(duringReload.start).some((message) => message.role === "assistant"
      && message.content.some((part) => part.type === "toolCall" && part.name === "session_send")), "sender reaches session_send during reload");
    assert.equal(peers(recipient, reloadStart).length, 0, "The retiring runtime receives no peer input");
    await writeFile(reloadRelease, "release");
    await reload;
    assert.notEqual(snapshot(recipient).streamId, previousStream, "Capability reload replaces the SDK host");
    assert.equal((await duringReload.completion).status, "completed");
    const deliveredAfterReload = receipt(sender, duringReload.start);
    assert.deepEqual([deliveredAfterReload.accepted, deliveredAfterReload.delivery], [true, "delivered"]);
    await idle(recipient);
    assert.deepEqual(peers(recipient, reloadStart).map((peer) => peer.messageId), [deliveredAfterReload.id], "The replacement runtime receives the peer exactly once");
    assert.equal(notices(recipient, reloadStart).length, 0, "Serialized admission is not a discarded message");
    const afterReload = await command(recipient, "B3-AFTER-RELOAD");
    assert.equal((await afterReload.completion).status, "completed");
    assert.deepEqual(peers(recipient, reloadStart).map((peer) => peer.messageId), [deliveredAfterReload.id], "Later input does not replay the peer");
    assert.equal(notices(recipient, afterReload.start).length, 0);

    const fallbackInitial = await command(recipient, "B3-FALLBACK-INITIAL");
    await until(() => exists(settleMarker), "public agent_before_settle after final turn_end");
    assert.equal(snapshot(recipient).messages.at(-1).role, "assistant");
    assert.equal(snapshot(recipient).messages.at(-1).stopReason, "stop");
    const fallbackPeer = await send(sender, recipient, "B3-RUN-END-FALLBACK");
    assert.deepEqual([fallbackPeer.accepted, fallbackPeer.delivery, fallbackPeer.pending], [true, "queued", 1]);
    assert.equal(peerUsers(recipient, fallbackInitial.start).length, 0, "Peer arrived after final turn_end");
    await writeFile(settleRelease, "release");
    assert.equal((await fallbackInitial.completion).status, "completed");
    await until(() => peers(recipient, fallbackInitial.start).some((peer) => peer.messageId === fallbackPeer.id), "run-end fallback starts new prompt");
    await idle(recipient);
    assert.deepEqual(peers(recipient, fallbackInitial.start).map((peer) => [peer.sender, peer.messageId]), [[snapshot(sender).sessionId, fallbackPeer.id]], "Fallback delivers once");
    assert.equal(modelCalls.filter((call) => call.role === "user" && parsePeerMessages(call.body)?.some((peer) => peer.messageId === fallbackPeer.id)).length, 1);
    assert.equal(notices(recipient, fallbackInitial.start).length, 0, "Successful fallback is not discard");

    await checkHandledInput({ modelRuntime, faux, root, home, extensionBehavior, until, text });
    console.log(JSON.stringify({ ok: true, phase: "B3", cancelledPeerIds: [processLong.id, sdkPeer.id, inboxPeer.id], serializedPeerId: deliveredAfterReload.id, fallbackPeerId: fallbackPeer.id, returnedMessages: cancelled.returnedMessages }));
    console.log(JSON.stringify({ ok: true, phase: "B2", busySendMs: spans, mergedPeerIds: backlog.map((item) => item.id), caps: behavior.session.inboxMaxMessages }));
  });
} finally { await rm(root, { recursive: true, force: true }); }
