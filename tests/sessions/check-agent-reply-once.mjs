import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePeerMessages } from "../../shared/session-messages/parse-peer-messages.js";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { checkAdmissionRace } from "./agent-reply-once/check-admission-race.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";

const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error(`Timed out: ${label}`);
}
const alreadyAnswered = /already answered; send a new message to add more/;
const root = await mkdtemp(join(tmpdir(), "prk-agent-reply-once-"));
const home = join(root, "home");
const agentDir = join(home, "agent");
let host;
const busyRelease = Promise.withResolvers();
await withTargetFixture(async ({ config }) => {
try {
  initializePrkHome(home);
  const [{ ModelRuntime }, { fauxAssistantMessage, fauxProvider, fauxToolCall }, { createGatewayHost }, { createAgentMessaging }, { parsePrkConfig }] = await Promise.all([
    import("@earendil-works/pi-coding-agent"),
    import("@earendil-works/pi-ai"),
    import("../../src/gateway/host/start-host.ts"),
    import("../../src/sessions/peer-messaging/assemble-peer-messaging.ts"),
    import("../../src/config/document/parse-prk-config.ts"),
  ]);
  await mkdir(agentDir, { recursive: true });
  // Read the actual isolated config file: the small retention cap must reach the Gateway's shared tools.
  await writeFile(join(home, "config.toml"), stringify({ session: { workerTools: "direct", rememberedRepliesMax: 2, inboxMaxMessages: 1 } }), { mode: 0o600 });
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({
    provider: "reply-once-check", models: [{ id: "root" }], tokensPerSecond: 10_000,
  });
  modelRuntime.registerNativeProvider(provider.provider);
  let capBusyEntered = false;
  provider.setResponses(Array.from({ length: 200 }, () => async (context) => {
    const last = context.messages.at(-1);
    if (text(last) === "CAP_BUSY") {
      capBusyEntered = true;
      await busyRelease.promise;
      return fauxAssistantMessage("Held generation released; queued peers can now flush.");
    }
    if (last?.role === "toolResult") return fauxAssistantMessage("Tool batch completed.");
    const command = /^SEND (\[.*\])$/s.exec(text(last));
    if (command) {
      return fauxAssistantMessage(JSON.parse(command[1]).map((args) => fauxToolCall("session_send", args)), { stopReason: "toolUse" });
    }
    return fauxAssistantMessage("Context processed; no automatic peer reply.");
  }));
  host = await createGatewayHost({
    cwd: root, home, historyDir: join(root, "history"), model: "reply-once-check/root", targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "fixture", cwd: root })],
  }, { runtimeDependencies: { model: provider.getModel("root"), modelRuntime, thinkingLevel: "off", cwd: root, agentDir } });
  await prepareGatewayEnvironment(host, home, "fixture");
  const createPeer = async (label) => (await host.createSession({ target: "fixture", label })).session.sessionId;
  const a = await createPeer("Question sender");
  const b = await createPeer("Reply sender");
  const c = await createPeer("Other reply sender");
  const snapshot = (name) => host.session(name).getSnapshot();
  const idle = (name) => until(() => !snapshot(name).operation, `idle ${name}`);
  const peers = (name) => snapshot(name).messages.filter((message) => message.role === "user")
    .flatMap((message) => parsePeerMessages(text(message)) ?? []);
  let request = 0;
  async function submit(name, message) {
    await idle(name);
    const admission = await host.session(name).submit({ requestId: `reply-once-${++request}`, message });
    assert.equal(admission.accepted, true, JSON.stringify(admission));
    assert.equal((await admission.completion).status, "completed");
  }
  async function sendBatch(name, args) {
    await idle(name);
    const start = snapshot(name).messages.length;
    await submit(name, `SEND ${JSON.stringify(args.map((entry) => ({ ...entry, to: snapshot(entry.to).sessionId })))}`);
    const results = snapshot(name).messages.slice(start).filter((message) => message.role === "toolResult" && message.toolName === "session_send");
    assert.equal(results.length, args.length, "Every real SDK tool call produces an authoritative result");
    return results;
  }
  async function send(name, args) { return (await sendBatch(name, [args]))[0]; }
  function accepted(result) {
    assert(!result.isError, text(result));
    const receipt = JSON.parse(text(result));
    assert.equal(typeof receipt.id, "string");
    assert.equal(receipt.accepted, true, "Gateway receipt confirms inbox admission");
    return receipt;
  }
  function refused(result, reason = alreadyAnswered) {
    assert.equal(result.isError, true, text(result));
    assert.match(text(result), reason);
  }
  async function received(name, receipt, expected) {
    await idle(name);
    const entries = peers(name).filter((entry) => entry.messageId === receipt.id);
    assert.equal(entries.length, 1, "Accepted peer ID was delivered exactly once through the Gateway");
    for (const [key, value] of Object.entries(expected)) assert.equal(entries[0][key], key === "sender" ? snapshot(value).sessionId : value);
  }

  const question = accepted(await send(a, { to: b, message: "First question" }));
  await received(b, question, { sender: a, expectReply: true });
  const answer = accepted(await send(b, { to: a, message: "First answer", replyTo: question.id }));
  await received(a, answer, { sender: b, replyTo: question.id, expectReply: false });
  const beforeDuplicate = peers(a).length;
  refused(await send(b, { to: a, message: "Repeated answer must not arrive", replyTo: question.id }));
  assert.equal(peers(a).length, beforeDuplicate, "Repeated reply produces no delivery");
  const beforeGlobalDuplicate = peers(b).length;
  refused(await send(c, { to: b, message: "Another actor and recipient must not bypass the guard", replyTo: question.id }));
  assert.equal(peers(b).length, beforeGlobalDuplicate, "Reply memory is Gateway-wide, not per actor or recipient");
  refused(await send(a, { to: b, message: "No acknowledgement ping-pong", replyTo: answer.id }), /expects no reply/);
  assert.equal(peers(b).length, beforeGlobalDuplicate, "Existing no-reply refusal still delivers nothing");
  const supplement = accepted(await send(b, { to: a, message: "Supplement as a new message" }));
  await received(a, supplement, { sender: b, replyTo: "", expectReply: true });

  const batchQuestion = accepted(await send(a, { to: b, message: "Question for a duplicate tool batch" }));
  await received(b, batchQuestion, { sender: a });
  const batchResults = await sendBatch(b, [
    { to: a, message: "Batch answer one", replyTo: batchQuestion.id },
    { to: a, message: "Batch answer two", replyTo: batchQuestion.id },
  ]);
  assert.equal(batchResults.filter((result) => !result.isError).length, 1, "Only one duplicate in a real SDK tool batch is accepted");
  assert.equal(batchResults.filter((result) => result.isError).length, 1);
  refused(batchResults.find((result) => result.isError));
  const batchAnswer = accepted(batchResults.find((result) => !result.isError));
  await received(a, batchAnswer, { sender: b, replyTo: batchQuestion.id });
  assert.equal(peers(a).filter((entry) => entry.replyTo === batchQuestion.id).length, 1);

  const retryQuestion = accepted(await send(a, { to: b, message: "Question whose first answer admission fails" }));
  await received(b, retryQuestion, { sender: a });
  const busy = await host.session(a).submit({ requestId: "reply-once-cap-busy", message: "CAP_BUSY" });
  assert.equal(busy.accepted, true, JSON.stringify(busy));
  await until(() => capBusyEntered, "recipient's real SDK generation is held");
  const beforeFailedAdmission = peers(a).length;
  const filler = accepted(await send(b, { to: a, message: "Ordinary message fills the recipient inbox" }));
  assert.equal(filler.pending, 1, "Configured single-message inbox is full");
  assert.equal(filler.delivery, "queued");
  assert.equal(peers(a).length, beforeFailedAdmission, "Busy recipient has not consumed its inbox yet");
  refused(await send(b, { to: a, message: "Refused by full inbox", replyTo: retryQuestion.id }), /inbox message cap 1 is full/i);
  assert.equal(peers(a).length, beforeFailedAdmission, "Refused admission does not deliver a peer envelope");
  // A failed admission must not consume retention capacity and evict an older answered ID.
  refused(await send(c, { to: b, message: "Old reply remains remembered after admission failure", replyTo: question.id }));
  busyRelease.resolve();
  assert.equal((await busy.completion).status, "completed");
  await received(a, filler, { sender: b, replyTo: "" });
  const retriedAnswer = accepted(await send(b, { to: a, message: "Retry after refused admission", replyTo: retryQuestion.id }));
  await received(a, retriedAnswer, { sender: b, replyTo: retryQuestion.id });
  refused(await send(c, { to: b, message: "Newest successful reply remains remembered", replyTo: retryQuestion.id }));
  refused(await send(c, { to: b, message: "Second successful reply remains remembered", replyTo: batchQuestion.id }));
  const evictedAnswer = accepted(await send(b, { to: a, message: "Oldest replied ID was evicted by the configured cap", replyTo: question.id }));
  await received(a, evictedAnswer, { sender: b, replyTo: question.id });

  await checkAdmissionRace(createAgentMessaging, parsePrkConfig, alreadyAnswered);

  console.log("PASS reply-once: real Gateway/SDK first reply, global repeat refusal with no delivery, duplicate tool batch, no-reply brake, inbox-cap admission failure/retry, configured retention eviction; controlled application-tool admission race without SDK patches");
} finally {
  busyRelease.resolve();
  await host?.close();
  await rm(root, { recursive: true, force: true });
}
});
