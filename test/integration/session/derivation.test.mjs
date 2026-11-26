import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { DEFAULT_SESSION_OPTIONS } from "../../../src/config/session/session-options.ts";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { gatewayFixture, text, tool } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

test("real child tools deliver a result and notify the owner of an unsuccessful run", async (t) => {
  const resume = Promise.withResolvers();
  let recoveredAttempts = 0;
  const cancelStarted = Promise.withResolvers();
  t.after(() => resume.resolve());
  const f = await gatewayFixture(t, { settings: { retry: { enabled: true, maxRetries: 1, baseDelayMs: 100 } }, answer(context, options) {
    const last = context.messages.at(-1);
    if (last?.role === "toolResult" && last.toolName === "ask") return resume.promise.then(() => fauxAssistantMessage("Continued after answer"));
    const body = text(last);
    if (body === "Transient failure" || (body === "Transient then succeeds" && ++recoveredAttempts === 1)) {
      return fauxAssistantMessage([], { stopReason: "error", errorMessage: "429 Too Many Requests" });
    }
    if (body === "Cancel this run") {
      cancelStarted.resolve();
      return new Promise((resolve) => options.signal.addEventListener("abort", () => resolve(fauxAssistantMessage("Cancelled")), { once: true }));
    }
    if (body === "Permanent failure") return fauxAssistantMessage([], { stopReason: "error", errorMessage: "401 Unauthorized" });
    if (body.includes("# Your assignment\nRESULT_CHILD")) return tool("session_result", { summary: "Delivered verification result" });
    if (body.includes("# Your assignment\nFAIL_CHILD")) return fauxAssistantMessage([], { stopReason: "error", errorMessage: "Verification child failed" });
  } });
  await f.stageArtifacts();
  const owner = await f.create("Owner");
  const spawn = (task) => f.send(owner, `TOOL ${JSON.stringify({ name: "session_spawn", args: { context: "Verification", tasks: [{ task, label: task }] } })}`);
  const findReceipt = (pattern, name) => until(() => f.state(owner).messages.find((message) => pattern.test(text(message)) && message.role !== "toolResult"), name);
  assert.equal((await f.complete(owner, await spawn("RESULT_CHILD"))).status, "completed");
  await findReceipt(/Delivered verification result/, "owner result receipt");
  await until(() => !f.state(owner).operation, "owner idle after receipt");
  const archived = await until(async () => (await f.request("workbench")).archive.flatMap((group) => group.sessions)
    .find((row) => row.label === "RESULT_CHILD"), "temporary child archived after delivery");
  assert.notEqual(archived.sessionId, owner);
  assert.equal(archived.owner, owner);
  assert.equal((await f.complete(owner, await spawn("FAIL_CHILD"))).status, "completed");
  const failed = await findReceipt(/派生会话运行失败/, "owner failure notice");
  assert.match(text(failed), /FAIL_CHILD/);
  assert.match(text(failed), /Verification child failed/);
  const row = (await f.request("workbench")).sessions.find((item) => item.label === "FAIL_CHILD");
  assert(row && text(failed).includes(row.sessionId), "failure notice names the retained child");

  await t.test("ask blocks the session only while a user answer is pending", async () => {
    const id = owner;
    await until(() => !f.state(id).operation, "owner idle after failure notice");
    const row = async () => (await f.request("workbench")).sessions.find((session) => session.sessionId === id);
    const receipt = await f.send(id, `TOOL ${JSON.stringify({ name: "ask", args: { questions: [
      { id: "choice", question: "Pick one", options: [{ label: "First" }, { label: "Second" }] },
    ] } })}`);
    const prompt = await until(() => f.state(id).extensionUi?.prompts.find((dialog) => dialog.kind === "ask"), "live ask dialog");
    assert.equal((await row()).blocked, true);
    assert.equal((await row()).state, "running");
    assert.equal((await f.request("state", { sessionId: id })).blocked, true);
    const answer = await f.request("nativeAction", { sessionId: id, requestId: crypto.randomUUID(), action: "extension-ui", args: {
      operation: "dialog", id: prompt.id, answers: [{ id: "choice", selected: [0] }],
    } });
    assert.equal(answer.status, "completed");
    assert.equal((await row()).blocked, undefined);
    assert.equal((await row()).state, "running");
    assert.equal((await f.request("state", { sessionId: id })).blocked, undefined);
    resume.resolve();
    assert.equal((await f.complete(id, receipt)).status, "completed");
    assert.equal((await row()).state, "idle");
  });

  await t.test("shows exhausted and permanent provider errors as stopped, without flashing on retry or cancellation", async () => {
    const events = [];
    const unsubscribe = f.client.onCollectionEvent((event) => {
      if (event.sessionId === owner && event.type === "session_attention_changed") events.push(event.details);
    });
    await f.request("subscribeSessions");
    const row = async () => (await f.request("workbench")).sessions.find((session) => session.sessionId === owner);
    const send = async (message) => f.complete(owner, await f.send(owner, message));
    try {
      assert.equal((await send("Transient then succeeds")).status, "completed");
      assert.equal(recoveredAttempts, 2);
      assert(!events.some(({ stopped }) => stopped));
      assert.equal((await row()).retryPending, undefined);
      assert.equal((await send("Permanent failure")).status, "failed");
      assert.equal((await row()).state, "idle");
      assert.equal((await row()).retryPending, undefined);
      assert.equal((await row()).stopped, true);
      const cancel = await f.send(owner, "Cancel this run");
      await cancelStarted.promise;
      assert.equal((await row()).stopped, undefined);
      await f.request("cancel", { sessionId: owner, operationId: cancel.operationId });
      assert.equal((await f.complete(owner, cancel)).status, "cancelled");
      assert.equal((await row()).state, "idle");
      assert.equal((await row()).stopped, undefined);
      events.length = 0;

      assert.equal((await send("Transient failure")).status, "failed");
      await until(() => events.some(({ retryPending }) => retryPending), "retry grace projection");
      assert(!events.some(({ stopped }) => stopped), "retry grace kept the row running");
      await until(() => events.some(({ stopped }) => stopped), "stopped after retry grace");
      assert.equal((await row()).stopped, true);
      assert.equal((await row()).retryPending, undefined);
      assert.equal((await f.request("state", { sessionId: owner })).stopped, true);
      const next = await f.send(owner, "Continue after failure");
      await until(() => events.some(({ stopped }, i) => stopped === false && events.slice(0, i).some((e) => e.stopped)), "next send clears stopped");
      assert.equal((await row()).stopped, undefined);
      assert.equal((await f.complete(owner, next)).status, "completed");

      events.length = 0;
      assert.equal((await send("Transient failure")).status, "failed");
      await until(() => events.some(({ retryPending }) => retryPending), "new retry grace");
      assert.equal((await send("Start again inside grace")).status, "completed");
      await delay(DEFAULT_SESSION_OPTIONS.providerRetryGraceMs);
      assert(!events.some(({ stopped }) => stopped), "retired retry grace did not mark the new turn stopped");
    } finally { unsubscribe(); }
  });
});
