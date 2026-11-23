// Real Pi SDK + owned Jupyter + isolated Gateway/socket/HTTP. Every model assertion observes the
// faux provider's actual transcript, not a reconstructed prompt or a mocked session/store.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { createMemoryStack } from "./memory/create-stack.mjs";
import { checkMemoryWrites } from "./memory/check-writes.mjs";

const root = await mkdtemp(join(tmpdir(), "prk-memory-"));
const { agentDir } = initializePrkHome(root);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
async function deadline(promise, label, timeoutMs = 15_000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out: ${label}`)), timeoutMs); })]);
  } finally { clearTimeout(timer); }
}
async function until(read, check, label) {
  const expires = Date.now() + 15_000;
  for (;;) {
    const value = await read();
    if (check(value)) return value;
    if (Date.now() >= expires) throw new Error(`timed out: ${label}`);
    await sleep(20);
  }
}

try {
  await mkdir(agentDir);
  process.env.SHELL = "/bin/bash";
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools, getCurrentSystemMessage, getSystemMessageText } = await import("@earendil-works/pi-ai");
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");

  await withTargetFixture(async ({ config, owned, onCleanup }) => {
    assert.equal(owned, true, "check-memory requires the owned fixture; unset JUPYTER_URL and JUPYTER_TOKEN");
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "memory-check", models: [{ id: "primary" }, { id: "alternate" }], tokensPerSecond: 100_000 });
    runtime.registerNativeProvider(provider.provider);
    const payloads = [], reviewStarts = [], reviewEnds = [], reviewPlans = [];
    const gates = new Set();
    let mainGate;
    onCleanup(async () => { for (const gate of gates) gate.resolve(); });
    const respond = async (context, _options, _state, model) => {
      const tools = getCurrentTools(context.messages).map(({ name }) => name).sort();
      const commandMessage = context.messages.findLast((message) => message.role === "user" && text(message).startsWith("MEMORY_TEST "));
      const command = commandMessage ? JSON.parse(text(commandMessage).slice("MEMORY_TEST ".length)) : undefined;
      const review = tools.length === 1 && tools[0] === "memory";
      const seen = { messages: structuredClone(context.messages), tools, system: getSystemMessageText(getCurrentSystemMessage(context.messages)), model: `${model.provider}/${model.id}`, command, review };
      payloads.push(seen);
      if (review) {
        if (context.messages.at(-1)?.role === "toolResult") {
          reviewEnds.push(seen);
          return fauxAssistantMessage("REVIEW_PRIVATE_DONE_48271");
        }
        reviewStarts.push(seen);
        const plan = reviewPlans.shift();
        if (plan?.gate) await plan.gate.promise;
        if (plan?.operations) return fauxAssistantMessage(fauxToolCall("memory", { operations: plan.operations }), { stopReason: "toolUse" });
        reviewEnds.push(seen);
        return fauxAssistantMessage("Nothing to save");
      }
      if (context.messages.findLastIndex((message) => message.role === "toolResult") > context.messages.findLastIndex((message) => message.role === "assistant")) return fauxAssistantMessage(`MAIN_DONE_${command.id}`);
      if (command?.wait) await mainGate.promise;
      if (command?.tool) return fauxAssistantMessage(fauxToolCall(command.tool, command.args), { stopReason: "toolUse" });
      return fauxAssistantMessage(`MAIN_DONE_${command?.id}`);
    };
    provider.setResponses(Array.from({ length: 300 }, () => respond));
    const limits = { user: 128, memory: 128, instance: 128, control: 48 };
    let serial = 0;
    const setup = (name, memory, reviewTurns) => createMemoryStack({ name, memory, reviewTurns, root, config, limits, provider, runtime, onCleanup, payloads, text, deadline, nextId: () => ++serial });
    await checkMemoryWrites({ setup, text });


    // Interval 2, per-session user turns, same selected model, native snapshot, memory-only review.
    const r = await setup("review", {}, 2);
    const reviewer = await r.create(), other = await r.create();
    const human = await r.create();
    const beforeHuman = reviewStarts.length;
    for (let index = 0; index < 2; index++) {
      await r.turn(await r.create(), "session_send", { to: r.host.state(human).sessionId, message: `PEER_INPUT_${index}`, expectReply: false });
      await until(() => r.host.state(human), (state) => state.state === "idle" && state.messages.some((message) => message.role === "assistant" && text(message).startsWith("MAIN_DONE_"))
        && state.messages.filter((message) => message.role === "user").length === index + 1, "peer input settles");
    }
    assert.equal(reviewStarts.length, beforeHuman, "two session_send user-role messages must not trigger memory review");
    for (let index = 0; index < 2; index++) {
      const admission = await r.host.session(human).submit({ requestId: `internal-${index}`, message: `INTERNAL_${index}`, internalNotification: { fixture: true } });
      assert.equal(admission.accepted, true);
      assert.equal((await admission.completion).status, "completed");
    }
    assert.equal(r.host.state(human).messages.filter((message) => message.role === "custom" && message.customType === "gateway-internal-notification").length, 2, "notifications stay custom SDK messages");
    await r.turn(human);
    assert.equal(reviewStarts.length, beforeHuman, "custom notifications do not count toward the first human input");
    await r.turn(human);
    await until(() => reviewEnds.length, (count) => count === beforeHuman + 1, "two human prompts trigger review");
    assert.equal(reviewStarts.length, beforeHuman + 1);
    for (const queue of ["steer", "followUp"]) {
      const worker = await r.create(), before = reviewStarts.length;
      mainGate = Promise.withResolvers(); gates.add(mainGate);
      const id = ++serial;
      const initial = await r.host.nativeSend(worker, { sessionId: worker, requestId: `busy-${id}`, message: `MEMORY_TEST ${JSON.stringify({ id, wait: true })}`, mode: "plain" });
      assert.equal(initial.accepted, true);
      await until(() => payloads, (seen) => seen.some((payload) => !payload.review && payload.command?.id === id), "busy human prompt reaches provider");
      const queuedId = ++serial;
      const queued = await r.host.nativeSend(worker, { sessionId: worker, requestId: `queued-${queuedId}`, message: `MEMORY_TEST ${JSON.stringify({ id: queuedId })}`, mode: "plain", queue });
      assert.equal(queued.accepted, true);
      mainGate.resolve(); gates.delete(mainGate);
      assert.equal((await deadline(initial.completion, `${queue} operation`)).status, "completed");
      assert.equal((await queued.completion).status, "completed");
      await until(() => reviewEnds.length, (count) => count === before + 1, `human ${queue} counts toward review`);
      assert.equal(reviewStarts.length, before + 1);
      assert(r.host.state(worker).messages.some((message) => message.role === "user" && text(message).includes(`"id":${queuedId}`)), `${queue} was consumed by the real SDK`);
    }
    assert.equal((await r.action(reviewer, "model", { model: "memory-check/alternate" })).status, "completed");
    const startReviews = reviewStarts.length, startEnds = reviewEnds.length;
    const roundOne = await r.turn(reviewer);
    await r.turn(other);
    await sleep(100);
    assert.equal(reviewStarts.length, startReviews, "turn counters belong to sessions, not the Gateway");
    const gate = Promise.withResolvers(); gates.add(gate);
    reviewPlans.push({ gate, operations: [
      { target: "user", action: "add", content: "REVIEW_USER_41821" },
      { target: "instance", action: "add", content: "REVIEW_INSTANCE_41821" },
      { target: "control", action: "add", content: "REVIEW_CONTROL_41821" },
    ] });
    const roundTwo = await r.turn(reviewer, undefined, undefined, false, 5_000);
    await until(() => reviewStarts.length, (count) => count === startReviews + 1, "second-turn background review");
    const review = reviewStarts.at(-1);
    assert.equal(review.model, "memory-check/alternate", "review uses this session's selected model, not the Gateway default");
    assert.deepEqual(review.tools, ["memory"]);
    const reviewInput = text(review.messages.findLast((message) => message.role === "user"));
    for (const id of [roundOne.id, roundTwo.id]) {
      assert(review.messages.some((message) => text(message).includes(`MAIN_DONE_${id}`)), "review starts after the main reply and receives its current native context");
    }
    await r.turn(reviewer);
    await r.turn(reviewer);
    assert.equal(reviewStarts.length, startReviews + 1, "an in-flight review is not duplicated when another interval elapses");
    gate.resolve(); gates.delete(gate);
    await until(() => r.notices(reviewer, "review"), (list) => list.length === 1, "saved-changes review notice");
    await until(() => reviewEnds.length, (count) => count === startEnds + 1, "review native loop completion");
    assert.equal(await r.disk("user"), "REVIEW_USER_41821");
    assert.equal(await r.disk("instance"), "REVIEW_INSTANCE_41821");
    assert.equal(await r.disk("control"), "REVIEW_CONTROL_41821", "review control writes save immediately");
    assert.deepEqual(r.notices(reviewer, "control")[0].details.changes, [{ target: "control", action: "add", after: "REVIEW_CONTROL_41821" }]);
    const mainMessages = r.host.state(reviewer).messages;
    assert(!mainMessages.some((message) => text(message) === reviewInput || text(message).includes("REVIEW_PRIVATE_DONE_48271")), "review prompts and replies never enter main history");
    assert(!mainMessages.some((message) => message.role === "toolResult" && message.toolName === "memory"), "review tool results never occupy main context");
    assert.equal(r.notices(reviewer, "review")[0].details.changes.length, 2);
    const reset = await r.create();
    const beforeReset = reviewStarts.length;
    await r.turn(reset);
    await r.memoryCall(reset, { target: "memory", action: "add", content: "MAIN_MEMORY_RESETS" });
    await sleep(100);
    assert.equal(reviewStarts.length, beforeReset, "successful main-model memory use clears the two-turn counter before review");
    await r.turn(reset);
    await sleep(100);
    assert.equal(reviewStarts.length, beforeReset, "the first user turn after memory remains below interval");
    await r.turn(reset);
    await until(() => reviewStarts.length, (count) => count === beforeReset + 1, "second user turn after main memory");
    await until(() => reviewEnds.length, (count) => count === startEnds + 2, "nothing-to-save review completion");
    await sleep(100);
    assert.equal(reviewStarts.length, beforeReset + 1, "review itself does not recursively schedule another review");
    assert.deepEqual(r.notices(reset, "review"), [], "Nothing to save produces no saved-changes notice");
    await r.stop();

    const d = await setup("disabled", { enabled: false }, 2);
    for (const target of ["control", "user", "memory", "instance"]) await d.manual(target, [`DISABLED_${target.toUpperCase()}_74521`]);
    const disabledFiles = await Promise.all(["control", "user", "memory", "instance"].map((target) => d.disk(target)));
    const disabledDirect = await d.create(), disabledCode = await d.create("code");
    const beforeDisabled = reviewStarts.length;
    for (let index = 0; index < 3; index++) {
      const observed = await d.turn(disabledDirect);
      assert(!observed.tools.includes("memory"), "disabled memory is absent from actual direct provider declarations");
      assert(!observed.system.includes("DISABLED_"), "disabled memory does not inject any target");
      assert(observed.system.includes("SOUL_FIXTURE_92741"), "soul remains independent of memory.enabled");
    }
    const disabledCall = await d.codeCall(disabledCode, { target: "user", action: "add", content: "must-not-save" }, true);
    assert(!disabledCall.tools.includes("memory"));
    assert(!disabledCall.system.includes("DISABLED_"));
    await sleep(100);
    assert.equal(reviewStarts.length, beforeDisabled, "disabled memory never triggers interval reviews");
    assert.deepEqual(await Promise.all(["control", "user", "memory", "instance"].map((target) => d.disk(target))), disabledFiles, "disabled memory leaves all files intact and gateway.memory refuses writes");
    await d.stop();
    assert.equal(reviewPlans.length, 0, "all controlled review scripts were exercised");
    console.log("PASS check-memory: real provider payloads; frozen/reloaded/scoped memory; strict atomic limits; direct control writes and notices; code/direct; same-model memory-only review and counter reset; disabled/soul cutover");
  }, { allowHidden: true });
} finally {
  await rm(root, { recursive: true, force: true });
}
