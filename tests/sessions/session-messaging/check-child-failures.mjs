import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { waitForSessionCondition } from "../derivation/wait-for-session-condition.mjs";

export async function checkChildFailures(f, owner) {
  const gate = Promise.withResolvers();
  f.failAfter(gate.promise);
  let child, failedOperation;
  try {
    const spawned = await f.call(owner, "session_spawn", { context: "Test the first run failure.", tasks: [{ task: "FAIL_DERIVED_TURN", label: "Failure notice child", lifecycle: "persistent" }] });
    assert.deepEqual(spawned.errors, []);
    child = spawned.children[0];
    failedOperation = f.host.state(child.sessionId).operation;
    assert(failedOperation, "child's first operation is still blocked in the provider");
    await f.idle(owner);
  } finally { gate.resolve(); }
  // Settle the owner before the child fails: the only way to invoke its provider again is inbox wake.
  await f.idle(owner);
  const notices = () => f.peers(owner).filter(({ sender, body }) => sender === child.sessionId && body.startsWith("[派生会话运行失败 /"));
  const submit = async (message) => {
    const run = await f.host.session(child.sessionId).submit({ requestId: randomUUID(), message });
    assert.equal(run.accepted, true, JSON.stringify(run));
    return run;
  };
  const expectWake = async (count, from, type, run) => {
    const deadline = AbortSignal.timeout(4000);
    while (notices().length < count && !deadline.aborted) await setTimeout(20);
    assert.equal(notices().length, count, `one ${type} notification reaches the owner`);
    await f.idle(owner);
    const { body, expectReply } = notices().at(-1);
    const data = JSON.parse(body.slice(body.indexOf("\n") + 1));
    assert.equal(expectReply, false);
    assert.deepEqual(
      [data.sessionId, data.sessionName, data.operationId, data.type, data.summary.includes(type === "failed" ? "fixture provider failure" : "cancelled")],
      [child.sessionId, child.sessionName, run.operationId, type, true],
    );
    assert(data.summary.length <= 500);
    assert(f.requests.slice(from).some(({ messages }) => messages.at(-1)?.role === "user" && f.text(messages.at(-1)).includes(body)), "idle owner was actually invoked with the notice");
  };
  const beforeError = f.requests.length;
  await expectWake(1, beforeError, "failed", failedOperation);
  const failure = f.host.state(child.sessionId).recentOperations.find(({ operationId }) => operationId === failedOperation.operationId);
  assert.equal(failure?.status, "failed");
  assert.equal(f.get(child.sessionId).derivation.phase, "working");
  assert.equal(f.get(child.sessionId).state, "idle");

  const beforeAbort = f.requests.length;
  let started = false;
  f.onStreamStart(() => { started = true; });
  const aborted = await submit("ABORT_DERIVED_TURN");
  await waitForSessionCondition(() => started, "child entered faux provider before cancel");
  const cancel = await f.host.session(child.sessionId).cancel({ operationId: aborted.operationId });
  assert.equal(cancel.status, "requested");
  assert.equal((await aborted.completion).status, "cancelled");
  await expectWake(2, beforeAbort, "cancelled", aborted);

  started = false;
  const ownerAborted = await submit("ABORT_DERIVED_TURN");
  await waitForSessionCondition(() => started, "child entered faux provider before owner abort");
  await f.call(owner, "session_send", { to: child.sessionId, message: "Retry after my interruption.", delivery: "abort", expectReply: false });
  assert.equal((await ownerAborted.completion).status, "cancelled");
  await f.idle(child.sessionId);

  await f.call(child.sessionId, "session_result", { summary: "Recovered and finished." });
  await f.idle(owner);
  assert.equal(f.get(child.sessionId).derivation.phase, "delivered");
  assert.equal(f.peers(owner).filter(({ sender, body }) => sender === child.sessionId && body.startsWith("[派生会话任务结果 /")).length, 1);
  assert.equal(notices().length, 2, "owner abort and completed retry do not add failure notices");
}
