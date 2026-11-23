import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function checkObservation(f, owner) {
  const child = await f.spawn(owner, "Recent observation child");
  const target = child.sessionId;
  const route = f.get(target).sessionId;
  assert.notEqual(route, target, "The regression exercises real native-id versus Gateway-route separation");
  for (let index = 0; index < 12; index++) {
    const admission = await f.host.session(route).submit({ requestId: randomUUID(), message: `OBSERVE_TEXT ${index}` });
    assert.equal(admission.accepted, true);
    assert.equal((await admission.completion).status, "completed");
  }
  const recent = Array.from({ length: 12 }, (_, index) => [
    { role: "user", text: `OBSERVE_TEXT ${index}` },
    { role: "assistant", text: `OBSERVED_${index}` },
  ]).flat();
  for (const limit of [undefined, 1, 3, 20]) {
    const observed = await f.call(owner, "session_list", { sessionId: target, ...(limit === undefined ? {} : { limit }) });
    assert.deepEqual(Object.keys(observed).sort(), ["parentSessionId", "phase", "recent", "role", "sessionId", "sessionName", "state"]);
    assert.equal(observed.role, "task");
    assert.equal(observed.sessionId, target);
    assert.equal(observed.sessionName, child.sessionName);
    assert.equal(observed.parentSessionId, f.get(owner).sessionId);
    assert.equal(observed.phase, "working");
    assert.deepEqual(observed.recent, recent.slice(-(limit ?? 6)), "Recent is the chronological last requested observable entries, not full history or reversed messages");
  }
  for (const args of [
    { sessionId: target, limit: 0 }, { sessionId: target, limit: 21 },
    { sessionId: "" }, { sessionId: target, unknown: true },
  ]) await f.call(owner, "session_list", args, /limit|sessionId|unknown|additional|property|parameter|schema|integer|number|string|empty/i);
  await f.call(owner, "session_list", { sessionId: "not-a-managed-session" }, /not managed|Unknown session|NOT_FOUND/i);
  const self = await f.call(target, "session_list", { sessionId: target, limit: 1 });
  assert.equal(self.sessionId, target, "A session can observe itself without management authority");
  const long = `BOUND_TEXT_${"x".repeat(900)}`;
  const turn = await f.host.session(route).submit({ requestId: randomUUID(), message: `OBSERVE_TEXT ${long}` });
  assert.equal((await turn.completion).status, "completed");
  const bounded = await f.call(owner, "session_list", { sessionId: target, limit: 2 });
  assert.deepEqual(bounded.recent.map(({ role }) => role), ["user", "assistant"]);
  assert(bounded.recent.every(({ text }) => text.length <= 600));
  assert(bounded.recent[1].text.startsWith("OBSERVED_BOUND_TEXT_"));
  await f.call(target, "kernel_code", { code: "print('FRESH_TOOL_RESULT_' + 'z' * 900)" });
  const tools = await f.call(owner, "session_list", { sessionId: target, limit: 6 });
  const call = tools.recent.findIndex((entry) => entry.role === "assistant" && entry.toolName === "kernel_code");
  const result = tools.recent.findIndex((entry) => entry.role === "toolResult" && entry.toolName === "kernel_code");
  assert(call >= 0 && result > call, "Tool call and actual SDK result remain in chronological order");
  assert(tools.recent[result].text.includes("FRESH_TOOL_RESULT_"));
  assert.equal(tools.recent[result].isError, false);
  assert(tools.recent.every(({ text }) => text.length <= 600));
  const busy = await f.hold(target);
  try {
    const running = await f.call(owner, "session_list", { sessionId: target });
    assert.equal(running.state, "running");
    assert(running.recent.some((entry) => entry.role === "assistant" && entry.toolName === "kernel_code" && entry.text.includes("acceptance barrier timeout")), "A currently running tool is observable before its result exists");
    assert.equal(f.host.state(route).operation.operationId, busy.operationId, "Observation neither cancels nor replaces the running operation");
  } finally { await busy.release(); }
  await f.call(target, "kernel_code", { code: "raise RuntimeError('OBSERVED_TOOL_FAILURE')" }, /OBSERVED_TOOL_FAILURE/);
  const failed = await f.call(owner, "session_list", { sessionId: target });
  assert(failed.recent.some((entry) => entry.role === "toolResult" && entry.toolName === "kernel_code" && entry.isError === true && entry.text.includes("OBSERVED_TOOL_FAILURE")));
  await f.host.closeSession(route);
  const before = structuredClone(f.get(target));
  const count = f.requests.length;
  const sleeping = await f.call(owner, "session_list", { sessionId: target });
  assert.equal(sleeping.state, "closed");
  assert.equal(f.get(target).state, before.state);
  assert.deepEqual(f.get(target).kernel, before.kernel, "A historical observation allocates no target kernel");
  assert.equal(f.requests.length, count + 2, "Only the observer's tool request and completion invoke its model; the target stays dormant");
}
