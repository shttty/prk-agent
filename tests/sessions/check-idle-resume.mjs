import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { checkIdleBrowser } from "./idle-resume/check-browser.mjs";
import { checkInitialSleep } from "./idle-resume/check-initial-sleep.mjs";

import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";
const browserSegment = process.env.PI_TEST_IDLE_BROWSER === "1";
if (browserSegment && !(process.env.PI_TEST_PLAYWRIGHT && process.env.PI_TEST_CHROMIUM)) throw new Error("PI_TEST_IDLE_BROWSER=1 requires PI_TEST_PLAYWRIGHT and PI_TEST_CHROMIUM.");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(25);
  }
  throw new Error(`Timed out: ${label}`);
}
const userTexts = (snapshot) => snapshot.messages.filter((message) => message.role === "user").map((message) => typeof message.content === "string" ? message.content : message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n"));

await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
  const pidFile = join(tempRoot, "idle-repl.pid");
  const runtime = await ModelRuntime.create({ authPath: join(tempRoot, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const faux = fauxProvider({ provider: "idle-fixture", models: [{ id: "controlled", reasoning: true }], tokensPerSecond: 10000 });
  runtime.registerNativeProvider(faux.provider);
  let modelCalls = 0;
  let releaseHeldResponse;
  faux.setResponses(Array.from({ length: 80 }, () => async (context) => {
    modelCalls++;
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") return fauxAssistantMessage("TOOL_COMPLETE");
    const value = JSON.stringify(last?.content);
    if (value.includes("HOLD_RESPONSE")) await new Promise((resolve) => { releaseHeldResponse = resolve; });
    if (value.includes("SEED_PYTHON")) return fauxAssistantMessage(fauxToolCall("kernel_code", { code: `import os\nfrom pathlib import Path\nPath(${JSON.stringify(pidFile)}).write_text(str(os.getpid()))\nidle_seed = 41\nprint('SEED', idle_seed)` }), { stopReason: "toolUse" });
    if (value.includes("CHECK_FRESH_PYTHON")) return fauxAssistantMessage(fauxToolCall("kernel_code", { code: "print('HAS_OLD_VARIABLE', 'idle_seed' in globals())" }), { stopReason: "toolUse" });
    if (value.includes("SPAWN_PENDING")) return fauxAssistantMessage(fauxToolCall("session_spawn", { context: "Complete the assigned child task and retain its explicit lifecycle responsibility.", tasks: [{ task: "Unfinished task must prevent idle collection", label: "Pending child", target: "local", lifecycle: "persistent" }] }), { stopReason: "toolUse" });
    return fauxAssistantMessage("RESPONSE_COMPLETE");
  }));
  const options = {
    cwd: tempRoot, home: tempRoot,
    historyDir: join(tempRoot, "idle-history"), model: "idle-fixture/controlled", thinkingLevel: "off",
    config: parsePrkConfig({ session: { workerTools: "direct", idleTimeoutMs: 800 }, targetCacheRoot: join(tempRoot, "target-cache") }),
    targets: [executionTargetFromConfig({ ...config, id: "local", label: "local", cwd: tempRoot })],
  };
  let targetAcquires = 0;
  const environments = createTargetEnvironments({ resolve: () => ({ local: true }), targetCacheRoot: options.config.targetCacheRoot });
  const targetEnvironments = { acquire: (id) => { targetAcquires++; return environments.acquire(id); } };
  const dependencies = { runtimeDependencies: { model: faux.getModel(), modelRuntime: runtime, thinkingLevel: "off", cwd: tempRoot, agentDir: tempRoot, targetEnvironments } };
  let host = await createGatewayHost(options, dependencies);
  onCleanup(async () => { releaseHeldResponse?.(); await host.close(); });
  await prepareGatewayEnvironment(host, tempRoot, "local");
  const all = () => host.workbench().sessions;
  const get = (name) => all().find((worker) => worker.sessionId === name);
  const snapshot = (name) => host.state(name);
  const send = async (name, message, queue) => {
    const result = await host.nativeSend(name, { sessionId: name, requestId: randomUUID(), message, mode: "plain", ...(queue ? { queue } : {}) });
    assert.equal(result.accepted, true, JSON.stringify(result));
    return result;
  };
  const complete = async (admission) => {
    const result = await admission.completion;
    assert.equal(result.status, "completed", JSON.stringify(result));
  };

  const { main, sessionId: worker, mainId, workerId, dormantWorkerStreamId, originalKernelId } = await checkInitialSleep({ host, tempRoot, complete, send, snapshot, get, until, pidFile });
  const callsBeforeReads = modelCalls;
  const acquiresBeforeReads = targetAcquires;
  host.nativeCapabilities(main);
  await delay(1000);
  assert.equal(snapshot(main).state, "sleeping");
  assert.equal(snapshot(worker).state, "sleeping");
  assert.equal(snapshot(worker).streamId, dormantWorkerStreamId, "repeated dormant snapshots keep stable identity");
  assert.equal(modelCalls, callsBeforeReads, "observing sleeping history does not run the model");
  assert.equal(targetAcquires, acquiresBeforeReads, "Reading sleeping state acquires no target");

  await host.close();
  host = await createGatewayHost(options, dependencies);
  assert.equal(get(main).state, "sleeping", "a daemon restart retains intentional sleep");
  assert.equal(get(worker).state, "sleeping");
  assert.notEqual(snapshot(worker).streamId, dormantWorkerStreamId, "a replacement Gateway does not reuse dormant counter ownership");
  assert.equal(modelCalls, callsBeforeReads, "restart does not replay old messages");
  assert.equal(targetAcquires, acquiresBeforeReads, "Loading sleeping history after restart acquires no target");
  // 从这里重来 / 改了重发 begin with tree navigation to a user message; like new input it wakes a sleeping session.
  const asleep = snapshot(main);
  const userIndex = asleep.messages.findIndex((message) => message.role === "user" && JSON.stringify(message.content).includes("BEFORE_SLEEP"));
  const userEntryId = asleep.messageEntryIds?.[userIndex];
  assert.equal(typeof userEntryId, "string", "sleeping snapshots expose user message entry ids");
  const backedUp = await host.nativeAction(main, { sessionId: main, requestId: randomUUID(), action: "tree", args: { entryId: userEntryId } });
  assert.equal(backedUp.status, "completed", JSON.stringify(backedUp));
  assert.equal(backedUp.data?.editorText, "BEFORE_SLEEP", "navigating to a user message returns its text");
  assert.equal(get(main).state, "idle", "tree navigation woke the sleeping main");
  assert.equal(modelCalls, callsBeforeReads, "backing up does not run the model");
  const lastReplyId = asleep.messageEntryIds?.findLast((id) => typeof id === "string" && id !== userEntryId);
  assert.equal((await host.nativeAction(main, { sessionId: main, requestId: randomUUID(), action: "tree", args: { entryId: lastReplyId } })).status, "completed", "return to the original leaf");
  const bridge = await startGateway(host, join(tempRoot, "idle-observer.sock"));
  const observer = await connectGateway(join(tempRoot, "idle-observer.sock"));
  onCleanup(async () => { observer.disconnect(); await bridge.close(); });
  const wakeEvents = [];
  observer.onEvent((event, source) => { if (source === worker) wakeEvents.push(event); });
  const asleepSubscription = await observer.request("subscribe", { sessionId: worker });
  assert.equal(asleepSubscription.state, "sleeping", "subscribing to an idle session does not allocate its runtime");
  assert.equal(asleepSubscription.streamId, snapshot(worker).streamId);
  await complete(await send(main, "AFTER_SLEEP"));
  assert.equal(snapshot(main).sessionId, mainId);
  assert.deepEqual(userTexts(snapshot(main)), ["BEFORE_SLEEP", "AFTER_SLEEP"]);
  const wakeAdmission = await send(worker, "CHECK_FRESH_PYTHON");
  await complete(wakeAdmission);
  await until(() => wakeEvents.some((event) => event.type === "request_accepted" && event.requestId === wakeAdmission.requestId), "existing logical observer receives the new runtime's first admission");
  const wakeStreamId = wakeEvents.find((event) => event.type === "request_accepted" && event.requestId === wakeAdmission.requestId).streamId;
  assert.notEqual(wakeStreamId, asleepSubscription.streamId);
  const wakeSnapshotIndex = wakeEvents.findIndex((event) => event.type === "snapshot" && event.streamId === wakeStreamId);
  const wakeDeltaIndex = wakeEvents.findIndex((event) => event.type !== "snapshot" && event.streamId === wakeStreamId);
  assert(wakeSnapshotIndex >= 0 && wakeSnapshotIndex < wakeDeltaIndex, "the existing socket receives a replacement observation snapshot before any new-stream delta");
  assert.equal(wakeEvents[wakeSnapshotIndex].details.snapshot.streamId, wakeStreamId);
  assert.equal(observer.lost, false);
  assert.equal(snapshot(worker).sessionId, workerId);
  assert.deepEqual(userTexts(snapshot(worker)), ["SEED_PYTHON", "CHECK_FRESH_PYTHON"]);
  assert.match(JSON.stringify(snapshot(worker).messages), /HAS_OLD_VARIABLE False/, "restored history does not pretend Python variables survived");
  assert.notEqual(get(worker).kernel?.kernelId, originalKernelId);
  assert(!snapshot(worker).messages.some((message) => message.role === "custom" && message.customType === "gateway-session-recovery" && message.display !== false), "automatic waking has no recurring visible variable-loss message");

  observer.disconnect();
  await host.closeSession(main);
  assert.equal(get(main).state, "closed", "explicitly ended sessions are not idle sleepers");
  // Ended is not final: the next message starts the main again with the same SDK identity.
  const callsBeforeClosedSend = modelCalls;
  await complete(await send(main, "RESUME_ENDED_MAIN"));
  assert.notEqual(get(main).state, "closed", "a message resumes an ended main");
  assert.equal(modelCalls, callsBeforeClosedSend + 1, "only the new message reaches the model");

  await until(() => get(worker).state === "sleeping", "worker re-enters idle sleep");
  // Opening a session wakes it ahead of input: no user message, same identity.
  const usersBeforeWake = JSON.stringify(userTexts(snapshot(worker)));
  assert.deepEqual(await host.wakeSession(worker), { sessionId: worker, sleeping: false });
  assert.notEqual(get(worker).state, "sleeping", "wakeSession wakes a sleeping worker");
  assert.equal(snapshot(worker).sessionId, workerId);
  assert.equal(JSON.stringify(userTexts(snapshot(worker))), usersBeforeWake, "waking admits no input");
  assert.deepEqual(await host.wakeSession(worker), { sessionId: worker, sleeping: false }, "waking an awake session is a no-op");
  await until(() => get(worker).state === "sleeping", "worker sleeps again after an input-free wake");
  const savedWorkerMessages = JSON.stringify(snapshot(worker).messages);
  await bridge.close();
  host = await createGatewayHost({ ...options, targets: [] }, dependencies);
  let failedWake = false;
  try { failedWake = (await host.nativeSend(worker, { sessionId: worker, requestId: randomUUID(), message: "FAILED_WAKE_TEXT", mode: "plain" })).accepted !== true; }
  catch { failedWake = true; }
  assert(failedWake, "missing target is an explicit wake failure");
  assert.equal(snapshot(worker).sessionId, workerId);
  assert.equal(get(worker).state, "sleeping");
  assert.equal(JSON.stringify(snapshot(worker).messages), savedWorkerMessages, "failed wake does not append or consume the new user message");

  await host.close();
  host = await createGatewayHost(options, dependencies);
  const busy = (await host.createSession({ target: "local", label: "Busy coordinator" })).session.sessionId;
  const held = await send(busy, "HOLD_RESPONSE");
  await until(() => typeof releaseHeldResponse === "function", "controlled generation starts");
  const queued = await send(busy, "QUEUED_FOLLOW_UP", "followUp");
  await delay(1200);
  assert.equal(get(busy).state, "running", "running and queued work cannot be idle-collected");
  releaseHeldResponse(); releaseHeldResponse = undefined;
  await complete(held); await complete(queued);
  assert.deepEqual(userTexts(snapshot(busy)), ["HOLD_RESPONSE", "QUEUED_FOLLOW_UP"]);

  // An ended worker is not stuck read-only: the next message brings a kernel back (reconnect, else new).
  await host.closeSession(worker);
  assert.equal(get(worker).state, "closed");
  await complete(await send(worker, "RESUME_CLOSED_WORKER"));
  assert.notEqual(get(worker).state, "closed", "a message resumes a closed worker");
  assert.ok(["new", "reconnected"].includes(get(worker).recovery?.status), JSON.stringify(get(worker).recovery));
  assert.equal(userTexts(snapshot(worker)).at(-1), "RESUME_CLOSED_WORKER", "the resuming message is admitted once");

  // When no kernel can be brought back the message is refused, explicitly marked as not submitted.
  await host.closeSession(worker);
  const beforeRefusal = JSON.stringify(snapshot(worker).messages);
  await host.close();
  host = await createGatewayHost({ ...options, targets: [] }, dependencies);
  const refusal = await host.nativeSend(worker, { sessionId: worker, requestId: randomUUID(), message: "NO_KERNEL_TEXT", mode: "plain" }).then(() => null, (error) => error);
  assert.equal(refusal?.code, "UNAVAILABLE", String(refusal));
  assert.equal(refusal.details?.submitted, false, "the refusal says the message was not sent");
  assert.equal(refusal.details?.stage, "kernel");
  assert.ok(refusal.details?.reason, "the refusal carries the reason");
  assert.equal(JSON.stringify(snapshot(worker).messages), beforeRefusal, "a refused message is not appended");
  await host.close();

  // A clean Gateway stop leaves an awake worker sleeping (selecting it wakes it), not closed.
  const longIdle = { ...options, config: parsePrkConfig({ session: { workerTools: "direct", idleTimeoutMs: 600000 }, targetCacheRoot: options.config.targetCacheRoot }) };
  host = await createGatewayHost(longIdle, dependencies);
  const awake = (await host.createSession({ target: "local", cwd: tempRoot, label: "Awake at restart" })).session.sessionId;
  await complete(await send(awake, "BEFORE_RESTART"));
  assert.equal(get(awake).state, "idle");
  const beforeRestartStreamId = snapshot(awake).streamId;
  await host.close();
  host = await createGatewayHost(longIdle, dependencies);
  assert.equal(get(awake).state, "sleeping", "a Gateway restart puts an awake worker to sleep instead of ending it (waking is covered above)");
  assert.notEqual(snapshot(awake).streamId, beforeRestartStreamId);
  assert.deepEqual(userTexts(snapshot(awake)), ["BEFORE_RESTART"], "restart replays nothing");
  await host.close();
  host = await createGatewayHost(options, dependencies);

  const owner = (await host.createSession({ target: "local", label: "Task owner" })).session.sessionId;
  await complete(await send(owner, "SPAWN_PENDING"));
  const child = all().find((entry) => entry.derivation?.createdBy === owner && entry.label === "Pending child");
  assert.ok(child, "real main tool creates an unresolved child task");
  await delay(1200);
  assert.notEqual(get(owner).state, "sleeping", "owner with an unresolved descendant remains available");
  assert.notEqual(get(child.sessionId).state, "sleeping", "unfinished child responsibility is not idle-collected");
  await checkIdleBrowser({ browserSegment, host, tempRoot, onCleanup, complete, send, snapshot, busy, get, userTexts, delay });
  console.log("PASS idle sleep/wake: real SDK histories retained; owned REPL reclaimed and recreated; browsing/restart never replay; new prompt once; explicit close stays closed; failed wake preserves messages; busy, queued and unresolved child tasks protected.");
});
