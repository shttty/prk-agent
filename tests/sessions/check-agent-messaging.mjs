import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";

const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, name) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) { if (await check()) return; await sleep(20); }
  throw new Error(`Timed out: ${name}`);
}
const HEADER = /^\[session-message from .*\(id=([^)]+)\) \/ message=([^\s/\]]+)/;

await withTargetFixture(async ({ config, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-agent-messaging-"));
  let host;
  onCleanup(async () => { await host?.close(); await rm(root, { recursive: true, force: true }); });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const faux = fauxProvider({ provider: "messaging-check", models: [{ id: "root" }], tokensPerSecond: 10000 });
  modelRuntime.registerNativeProvider(faux.provider);
  // Controlled provider: decisions follow the latest context message, so every hop crosses the real SDK loop.
  faux.setResponses(Array.from({ length: 200 }, () => async (context) => {
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") return fauxAssistantMessage("Tool completed.");
    const body = text(last);
    const command = /^TOOL (\{.*\})$/s.exec(body);
    if (command) {
      const { tool, args } = JSON.parse(command[1]);
      return fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" });
    }
    const peer = HEADER.exec(body);
    if (peer && body.includes("QUESTION")) {
      return fauxAssistantMessage(fauxToolCall("session_send", { to: peer[1], message: "ANSWER: the dataset has 42 rows", replyTo: peer[2] }), { stopReason: "toolUse" });
    }
    if (peer && body.includes("ANSWER")) return fauxAssistantMessage("ANSWER_RECEIVED — continuing my own task.");
    if (peer && body.includes("NOTE")) return fauxAssistantMessage("NOTE_ACCEPTED — requirement added to current task.");
    return fauxAssistantMessage("Task admitted.");
  }));

  host = await createGatewayHost({
    cwd: root, home: root, historyDir: join(root, "history"), model: "messaging-check/root",
    config: parsePrkConfig({ session: { workerTools: "direct", capabilities: { "lazy:tool:session_list": false } } }),
    targets: [executionTargetFromConfig({ ...config, id: "local", label: "Local instance", cwd: root })],
  }, { runtimeDependencies: { model: faux.getModel("root"), modelRuntime, thinkingLevel: "off", cwd: root, agentDir: root } });

  const snapshot = (name) => host.session(name).getSnapshot();
  const nativeId = (name) => snapshot(name).sessionId;
  const idle = (name) => until(() => !snapshot(name).operation, `idle ${name}`);
  let counter = 0;
  async function call(name, tool, args) {
    await idle(name);
    const start = snapshot(name).messages.length;
    const admission = await host.session(name).submit({ requestId: `check-${++counter}`, message: `TOOL ${JSON.stringify({ tool, args })}` });
    assert(admission.accepted, JSON.stringify(admission));
    return { start, completion: admission.completion };
  }
  function toolResult(name, tool, start) {
    const projected = snapshot(name).messages.slice(start).find((message) => message.role === "toolResult" && message.toolName === tool);
    const result = projected?.outputPreview ? host.toolContent(name, projected.toolCallId).result : projected;
    assert(result, `${tool} ran in ${name}`);
    assert(!result.isError, text(result));
    return JSON.parse(text(result));
  }

  await prepareGatewayEnvironment(host, root, "local");
  const main = (await host.createSession({ target: "local", label: "Coordinator" })).session.sessionId;
  const spawn = async (label) => {
    const { start, completion } = await call(main, "session_spawn", { context: "Complete the assigned test task on the selected target and submit an explicit result.", tasks: [{ task: `${label} task`, label, lifecycle: "persistent", target: "local" }] });
    await completion;
    const child = toolResult(main, "session_spawn", start).children[0];
    assert.equal(child.sessionName, label);
    const name = child.sessionId;
    await idle(name);
    return name;
  };
  const a = await spawn("Worker A");
  const b = await spawn("Worker B");

  // The roster includes the caller and marks only that row.
  const listing = await call(b, "session_list", {});
  await listing.completion;
  const peers = toolResult(b, "session_list", listing.start);
  assert.deepEqual(peers.map((peer) => peer.sessionId).sort(), [nativeId(main), nativeId(a), nativeId(b)].sort());
  for (const peer of peers) {
    const fields = ["parentSessionId", "sessionId", "sessionName", "state"];
    if (peer.sessionId === nativeId(b)) {
      assert.equal(peer.self, true);
      fields.push("self");
    }
    assert.deepEqual(Object.keys(peer).sort(), fields.sort());
  }
  assert.equal(peers.find((peer) => peer.sessionId === a).parentSessionId, nativeId(main));
  assert.equal(peers.find((peer) => peer.sessionId === a).sessionName, "Worker A");
  assert.equal(host.sessionControl().rootSessionId, null);
  const status = await call(b, "space_status", {});
  await status.completion;
  const discovered = toolResult(b, "space_status", status.start).sessions;
  assert(discovered.some((session) => session.sessionId === nativeId(b)));
  for (const rows of [peers, discovered]) {
    assert(rows.every((row) => !Object.hasOwn(row, "root")), "Null root omits the flag for every session");
  }
  host.assignProject(a, { id: "messaging-project", name: "Messaging project" });
  host.setSessionRoot({ sessionId: b });
  const roleList = await call(a, "session_list", {});
  await roleList.completion;
  const roleRows = toolResult(a, "session_list", roleList.start);
  assert.deepEqual(roleRows.filter((row) => row.self === true).map((row) => row.sessionId), [a]);
  const roleStatus = await call(a, "space_status", {});
  await roleStatus.completion;
  const spaceRows = toolResult(a, "space_status", roleStatus.start).sessions;
  for (const rows of [roleRows, spaceRows]) {
    assert.deepEqual(rows.filter((row) => Object.hasOwn(row, "root")).map((row) => [row.sessionId, row.root]), [[b, true]]);
    assert.deepEqual(rows.filter((row) => Object.hasOwn(row, "supervisor")).map((row) => [row.sessionId, row.supervisor]), [[a, true]]);
  }

  // A is busy in real Python; B asks it a question mid-work.
  const busy = await call(a, "kernel_code", { code: "import time\ntime.sleep(2)\nprint('long analysis finished')" });
  await until(() => snapshot(a).messages.slice(busy.start).some((message) => message.role === "assistant" && message.stopReason === "toolUse"), "A entered python");
  const ask = await call(b, "session_send", { to: nativeId(a), message: "QUESTION: how many rows does the dataset have?" });
  assert.equal((await ask.completion).status, "completed");
  const sent = toolResult(b, "session_send", ask.start);
  assert.equal(sent.delivery, "queued", "Busy recipient receives the message as steering");

  const aDone = await busy.completion;
  assert.equal(aDone.status, "completed");
  assert(aDone.requestIds.includes(`session-message:${sent.id}`), "Question joined A's running operation instead of starting a new one");
  const aMessages = snapshot(a).messages.slice(busy.start);
  const qIndex = aMessages.findIndex((message) => message.role === "user" && text(message).includes("QUESTION"));
  const reply = aMessages.slice(qIndex).find((message) => message.role === "toolResult" && message.toolName === "session_send");
  assert(reply && !reply.isError, "A answered through session_send");
  const replyReceipt = JSON.parse(text(reply));
  assert.equal(replyReceipt.to, nativeId(b));
  assert.equal(replyReceipt.delivery, "delivered", "Idle B is woken with a real turn");

  await idle(b);
  const bMessages = snapshot(b).messages;
  const answer = bMessages.findIndex((message) => message.role === "user" && text(message).includes("ANSWER: the dataset has 42 rows"));
  assert(answer >= 0, "B received the answer in its own session");
  assert.match(text(bMessages[answer]), new RegExp(`id=${nativeId(a)}\\) / message=${replyReceipt.id} / replyTo=${sent.id}`));
  assert(bMessages.slice(answer).some((message) => message.role === "assistant" && text(message).includes("ANSWER_RECEIVED")), "B's model processed the answer");

  // Ping-pong brake: a reply expects no answer by default, and the Gateway refuses replies to it.
  assert.equal(sent.expectReply, true, "A new message expects a reply");
  assert.equal(replyReceipt.expectReply, false, "A reply expects no reply unless asked");
  const aBeforeAck = snapshot(a).messages.length;
  const ack = await call(b, "session_send", { to: nativeId(a), message: "Thanks!", replyTo: replyReceipt.id });
  await ack.completion;
  const refused = snapshot(b).messages.slice(ack.start).find((message) => message.role === "toolResult" && message.toolName === "session_send");
  assert.equal(refused?.isError, true, "Replying to a no-reply message fails explicitly");
  assert.equal(snapshot(a).messages.length, aBeforeAck, "The refused acknowledgement never reached A");

  // Main adds a requirement to an idle worker; errors are explicit.
  const note = await call(main, "session_send", { to: nativeId(a), message: "NOTE: also report null counts." });
  await note.completion;
  const noteReceipt = toolResult(main, "session_send", note.start);
  assert.equal(noteReceipt.delivery, "delivered");
  await idle(a);
  assert(snapshot(a).messages.some((message) => message.role === "assistant" && text(message).includes("NOTE_ACCEPTED")));

  // A reply that itself asks something opts back into the reply hint.
  const mainBefore = snapshot(main).messages.length;
  const followUp = await call(a, "session_send", { to: nativeId(main), message: "FOLLOWUP: drop or impute the nulls?", replyTo: noteReceipt.id, expectReply: true });
  await followUp.completion;
  const followReceipt = toolResult(a, "session_send", followUp.start);
  assert.equal(followReceipt.expectReply, true);
  await idle(main);
  const followMessage = snapshot(main).messages.slice(mainBefore).find((message) => message.role === "user" && text(message).includes("FOLLOWUP"));
  assert(followMessage, "main received the follow-up");
  for (const args of [{ to: "missing", message: "hi" }, { to: nativeId(main), message: "hi" }]) {
    const bad = await call(main, "session_send", args);
    await bad.completion;
    const result = snapshot(main).messages.slice(bad.start).find((message) => message.role === "toolResult" && message.toolName === "session_send");
    assert.equal(result.isError, true);
  }
  console.log(JSON.stringify({ ok: true, question: sent, answer: replyReceipt }));
});
