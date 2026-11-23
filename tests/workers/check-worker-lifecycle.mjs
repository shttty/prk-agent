import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createSessionCollection } from "../../src/sessions/collection/assemble-collection.ts";
import { createSessionHost } from "../../src/sessions/host/assemble-host.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "worker-lifecycle-"));
const target = (name) => executionTargetFromConfig({ id: name, label: name, local: true, python: process.env.PI_TEST_PYTHON, cwd: root });
const targets = ["alpha", "beta", "gamma"].map(target);
const runtimeDependencies = {
  model: undefined,
  modelRuntime: {},
  thinkingLevel: "off",
  cwd: root,
  agentDir: root,
};
const manager = createSessionCollection(targets, { runtimeDependencies });
const create = (collection, targetName, sessionManager) => collection.create(targetName, sessionManager, {});
const alpha = SessionManager.inMemory(root);
const gamma = SessionManager.inMemory(root);
assert.deepEqual(manager.snapshot(), [], "Configured targets do not allocate placeholder sessions");

const events = [];
let throwingListenerCalls = 0;
const unsubscribe = manager.subscribe((event) => { events.push(event); });
const unsubscribeThrower = manager.subscribe(() => {
  throwingListenerCalls += 1;
  throw new Error("listener failure");
});
let startupClose;
const unsubscribeReentrant = manager.subscribe((event) => {
  if (event.type === "session_starting" && event.sessionId === gamma.getSessionId()) startupClose = manager.closeSession(gamma.getSessionId());
  else if (event.type === "session_closed" && event.sessionId === gamma.getSessionId()) void manager.closeSession(gamma.getSessionId());
});

await assert.rejects(create(manager, "alpha", alpha), /Session requires an explicit model/);
assert.equal(manager.snapshot().find(({ sessionId }) => sessionId === alpha.getSessionId()).state, "closed", "a failed start leaves no runtime, not a failed worker");
await assert.rejects(create(manager, "alpha", alpha), /Session requires an explicit model/, "the next use tries to start again");
assert.equal(throwingListenerCalls, events.length);
for (const event of events) assert.equal(JSON.stringify(event).includes("test-token"), false);
await assert.rejects(create(manager, "gamma", gamma), /Session requires an explicit model/);
await startupClose;
assert.equal(manager.snapshot().find(({ sessionId }) => sessionId === gamma.getSessionId()).state, "closed");
await manager.closeSession(alpha.getSessionId());
assert.equal(manager.snapshot().find(({ sessionId }) => sessionId === alpha.getSessionId()).state, "closed");
await assert.rejects(create(manager, "alpha", alpha), /permanently closed/);
await manager.closeSession(alpha.getSessionId());
await assert.rejects(manager.closeSession("missing"), /Unknown session/);
unsubscribeThrower();
unsubscribeReentrant();
await manager.close();
unsubscribe();
assert.deepEqual(manager.snapshot().map(({ sessionId, state }) => ({ sessionId, state })), [
  { sessionId: alpha.getSessionId(), state: "closed" },
  { sessionId: gamma.getSessionId(), state: "closed" },
]);
console.log("PASS: collection creation failures, sanitized events, listener isolation, startup-close race, tombstones, and collection close");

const deferred = () => Promise.withResolvers();
const tick = () => new Promise((resolve) => setImmediate(resolve));
const controlled = new Map();
// Only the SDK boundary is controlled: SessionHost owns operation and close state,
// and the real collection observes its public events.
const controlledFactory = async (target, dependencies) => {
  const control = { prompt: deferred(), closeGate: deferred(), closeError: undefined, closeCalls: 0 };
  controlled.set(target.id, control);
  const listeners = new Set();
  const emit = (event) => { for (const listener of listeners) listener(event); };
  let invocation;
  let aborted = false;
  const session = {
    sessionId: dependencies.sessionManager.getSessionId(),
    messages: [],
    get isIdle() { return invocation === undefined; },
    get isStreaming() { return invocation !== undefined; },
    isCompacting: false,
    pendingMessageCount: 0,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    prompt(task) {
      aborted = false;
      session.messages.push({ role: "user", content: task });
      invocation = (async () => {
        await control.prompt.promise;
        if (task === "fail") throw new Error("controlled task failure");
        session.messages.push({ role: "assistant", stopReason: aborted ? "aborted" : "stop", content: [{ type: "text", text: `done:${task}` }] });
      })().finally(() => {
        invocation = undefined;
        emit({ type: "agent_settled", aborted });
      });
      emit({ type: "agent_start" });
      return invocation;
    },
    async abort() { aborted = true; control.prompt.resolve(); await invocation?.catch(() => {}); },
    async waitForIdle() { await invocation?.catch(() => {}); },
    getSteeringMessages: () => [],
    getFollowUpMessages: () => [],
    clearQueue: () => ({ steering: [], followUp: [] }),
    async sendCustomMessage() {},
  };
  const host = createSessionHost({
    session,
    dispose: async () => {
      control.closeCalls += 1;
      await control.closeGate.promise;
      if (control.closeError) throw control.closeError;
    },
  });
  return { session, host, close: () => host.close() };
};
const controlledOptions = { runtimeDependencies: { ...runtimeDependencies, model: {} }, sessionFactory: controlledFactory };
const transitionManager = createSessionCollection([target("live"), target("closing")], controlledOptions);
const live = await create(transitionManager, "live", SessionManager.inMemory(root));
const firstTask = await live.host.submit({ requestId: "first", message: "first" });
assert.equal(transitionManager.snapshot().find(({ sessionId }) => sessionId === live.session.sessionId).state, "running");
controlled.get("live").prompt.resolve();
assert.equal((await firstTask.completion).status, "completed");
assert.equal(transitionManager.snapshot().find(({ sessionId }) => sessionId === live.session.sessionId).state, "idle");

controlled.get("live").prompt = deferred();
const failingTask = await live.host.submit({ requestId: "fail", message: "fail" });
controlled.get("live").prompt.resolve();
const failure = await failingTask.completion;
assert.equal(failure.status, "failed");
assert.match(failure.error, /controlled task failure/);
assert.equal(transitionManager.snapshot().find(({ sessionId }) => sessionId === live.session.sessionId).state, "idle", "a failed task fails only that task");

controlled.get("live").prompt = deferred();
const recoveryTask = await live.host.submit({ requestId: "recover", message: "recovered" });
controlled.get("live").prompt.resolve();
assert.equal((await recoveryTask.completion).status, "completed");
assert.equal(transitionManager.snapshot().find(({ sessionId }) => sessionId === live.session.sessionId).state, "idle");

controlled.get("live").prompt = deferred();
const cancelledTask = await live.host.submit({ requestId: "cancel", message: "cancel" });
await live.host.cancel({ operationId: cancelledTask.operationId });
assert.equal((await cancelledTask.completion).status, "cancelled");
assert.equal(transitionManager.snapshot().find(({ sessionId }) => sessionId === live.session.sessionId).state, "idle");

const closing = await create(transitionManager, "closing", SessionManager.inMemory(root));
const activeCloseTask = await closing.host.submit({ requestId: "close-active", message: "close-active" });
const activeClose = transitionManager.closeSession(closing.session.sessionId);
assert.equal(transitionManager.snapshot().find(({ sessionId }) => sessionId === closing.session.sessionId).state, "closing");
controlled.get("closing").prompt.resolve();
await tick();
controlled.get("closing").closeGate.resolve();
await Promise.all([activeCloseTask.completion, activeClose]);
assert.equal(transitionManager.snapshot().find(({ sessionId }) => sessionId === closing.session.sessionId).state, "closed");
controlled.get("live").closeGate.resolve();
await transitionManager.close();

const cleanupManager = createSessionCollection(["good", "bad", "slow"].map((name) => target(name)), controlledOptions);
const cleanupIds = {};
for (const name of ["good", "bad", "slow"]) {
  const sessionManager = SessionManager.inMemory(root);
  cleanupIds[name] = sessionManager.getSessionId();
  await create(cleanupManager, name, sessionManager);
}
const cleanupControls = ["good", "bad", "slow"].map((name) => controlled.get(name));
controlled.get("good").closeGate.resolve();
controlled.get("bad").closeError = new Error("controlled cleanup failure");
controlled.get("bad").closeGate.resolve();
const managerClose = cleanupManager.close();
setTimeout(() => controlled.get("slow").closeGate.resolve(), 10);
await assert.rejects(managerClose, AggregateError);
assert.deepEqual(cleanupManager.snapshot().map(({ sessionId, state }) => ({ sessionId, state })), [
  { sessionId: cleanupIds.good, state: "closed" },
  { sessionId: cleanupIds.bad, state: "closed" },
  { sessionId: cleanupIds.slow, state: "closed" },
]);
assert.deepEqual(cleanupControls.map(({ closeCalls }) => closeCalls), [1, 1, 1]);
await assert.rejects(cleanupManager.close(), AggregateError);
await assert.rejects(cleanupManager.closeSession(cleanupIds.bad), (error) => error instanceof AggregateError && error.errors.some((failure) => /controlled cleanup failure/.test(String(failure))));
await rm(root, { recursive: true, force: true });
console.log("PASS: real SessionHost task transitions/cancellation, active-task close, and aggregate cleanup failure/idempotency");
