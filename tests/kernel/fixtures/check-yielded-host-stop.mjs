import assert from "node:assert/strict";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";
import { createYieldedSdkCell, text, until, within } from "./create-yielded-sdk-cell.mjs";
import { controlledRunner } from "./start-window-runner.mjs";

export async function checkYieldedHostStop(tempRoot) {
  for (const [scenario, check] of Object.entries({ targeted: checkTargetedStop, timeout: checkRetirement, operation: checkOperationCancel })) {
    const runner = controlledRunner();
    const manager = SessionManager.create(tempRoot, join(tempRoot, scenario));
    const cleanups = [];
    const runtime = { target: "controlled", cwd: tempRoot, python: join(tempRoot, "not-a-python-executable"),
      acquire: async () => runner.lease, processWindow: parseProcessWindowLimits(), memoryMax: "4G", memorySwapMax: "0" };
    try {
      const f = await createYieldedSdkCell({ tempRoot, runtime, onCleanup: (fn) => cleanups.push(fn) },
        { ensure: false, sessionManager: manager, runnerMaxActiveCells: 2, parallelAsks: true });
      await check(await openTwoAsks(f, runner, manager, { queueNotices: scenario !== "operation" }));
      assert.deepEqual(f.errors, []);
    } finally { for (const cleanup of cleanups.reverse()) await cleanup(); }
    console.log(`PASS yielded SDK host stop: ${scenario}`);
  }
}

async function openTwoAsks(f, runner, manager, { queueNotices }) {
  let cursor = 0;
  const next = async (kind, owner) => {
    const { frame } = await until(() => runner.frames[cursor], `runner did not receive ${kind}`);
    cursor++;
    assert.equal(frame.kind, kind, JSON.stringify(frame));
    if (owner) assert.deepEqual(identity(frame), owner.cell, `wrong owner of ${kind}`);
    return frame;
  };
  const emit = (frame, body) => runner.emit({ generation: frame.generation, cellId: frame.cellId, ...body });
  const end = (frame, outcome = "ok") => emit(frame, { kind: "cell_end", re: frame.id, outcome });
  const ack = (frame) => emit(frame, { kind: "ack", re: frame.id });
  const asks = () => f.host.getSnapshot(false).extensionUi.prompts.filter(({ kind }) => kind === "ask");
  const active = () => f.host.getSnapshot(false).kernel.activeCells;
  const expectAsks = (...cells) => assert.deepEqual(asks().map(({ id }) => id), cells.map(({ ask }) => ask.id));
  const settle = async (run, status = "completed") => {
    assert.equal((await within(run.completion, "host operation did not settle")).status, status);
    await until(() => f.host.isIdle && f.session.isIdle, "host and Pi did not become idle");
  };
  const spawn = async (title, fenced = false) => {
    const run = await f.start(`controlled cell ${title}`, { title, settle: fenced });
    if (!fenced) end(await next("initialize"));
    const frame = await next("execute");
    emit(frame, { kind: "cell_admitted", re: frame.id, mode: "thread" });
    const yielded = await f.running(run);
    assert.deepEqual(yielded.cell, identity(frame));
    if (!fenced) await settle(run);
    return { ...yielded, run, frame, title };
  };
  const a = await spawn("A"), b = await spawn("B", true);
  await within(b.run.gate.entered.promise, "B did not enter the real Pi settlement window");
  const { idle, idleWaitPending, calls } = b.run.gate.window;
  assert(idle && idleWaitPending, "isIdle is true but the run's waitForIdle must still be held");
  assert.equal(f.host.getSnapshot(false).operation.operationId, b.run.operationId);
  assert.notEqual(a.cell.cellId, b.cell.cellId);
  assert.equal(a.cell.kernelId, b.cell.kernelId);
  assert.deepEqual(active().map(({ cellId }) => cellId), [a.cell.cellId, b.cell.cellId]);
  if (queueNotices) {
    await f.clock.advance(1000); // Queue both notices before the asks pause active-time clocks.
    assert.deepEqual(f.reminders.map(({ cellId, dueMs }) => [cellId, dueMs]), [a, b].map(({ cell }) => [cell.cellId, 1000]));
  }
  for (const cell of [a, b]) {
    const questions = [{ id: cell.title, question: `Continue ${cell.title}?`, options: [{ label: `Continue ${cell.title}` }] }];
    emit(cell.frame, { kind: "callback_chunk", channel: "gateway", requestId: 1, final: true,
      data: Buffer.from(JSON.stringify({ name: "ask", args: { questions } })).toString("base64") });
    cell.ask = await until(() => asks().find(({ cellId }) => cellId === cell.cell.cellId), `${cell.title}'s real hosted ask did not open`);
    assert.equal(cell.ask.kernelId, cell.cell.kernelId);
    assert.equal(cell.ask.questions[0].question, questions[0].question);
  }
  expectAsks(a, b);

  const native = (customType) => manager.getBranch().filter((entry) => entry.customType === customType);
  const held = () => {
    assert.deepEqual(native("kernel-event"), [], "unpublished notices, including completions, must wait for Pi settlement");
    assert.deepEqual(f.kernelWakeIds, []);
    assert.equal(f.provider.state.callCount, calls);
  };
  held();
  const noExtraFrames = () => assert.equal(runner.frames.length, cursor, "unowned cancel, callback reply, or replacement command");
  const answer = ({ ask, title }) => f.host.extensionUiAction({ operation: "dialog", id: ask.id, answers: [{ id: title, selected: [0] }] });
  const answerAndResume = async (cell) => {
    assert.equal((await answer(cell)).status, "completed");
    const reply = await next("callback_reply_chunk", cell);
    assert.equal(reply.requestId, 1);
    assert.equal(reply.final, true);
    assert.deepEqual(JSON.parse(Buffer.from(reply.data, "base64").toString("utf8")),
      { ok: true, value: `User answers:\n${cell.title}: Continue ${cell.title}` });
    ack(reply);
  };
  return { f, runner, manager, a, b, calls, active, expectAsks, next, end, ack, emit, settle, native, held, answer, answerAndResume, noExtraFrames };
}

async function checkTargetedStop(s) {
  const { f, runner, a, b, calls } = s;
  const selected = { kernelId: a.ask.kernelId, cellId: a.ask.cellId, cellOnly: true };
  const stale = { ...selected, kernelId: crypto.randomUUID() };
  assert.equal((await f.host.interruptCell(stale)).status, "not_found", "live cell id is insufficient with a stale generation");
  s.expectAsks(a, b);
  s.noExtraFrames();
  assert.equal((await f.host.interruptCell(selected)).status, "requested");
  s.ack(await s.next("cancel", a));
  s.expectAsks(b);
  assert.equal((await s.answer(a)).status, "unavailable", "late answer cannot restore A's ask");
  s.end(a.frame, "aborted");
  await until(() => s.active().length === 1, "A did not leave its slot");
  assert.deepEqual(s.active().map(({ cellId, waitingForAsk }) => [cellId, waitingForAsk]), [[b.cell.cellId, true]]);
  s.expectAsks(b);
  await s.answerAndResume(b);
  s.emit(b.frame, { kind: "stream", stream: "stdout", text: "B_COMPLETED_AFTER_ASK\n" });
  s.end(b.frame);
  await frozenReceipts(s, ["aborted", "ok"]);
  s.held();
  await releaseNotices(s, [`${b.cell.cellId}:finished`]);
  assert.equal(f.provider.state.callCount, calls + 1, "only B's completion starts a new model request");
  assert(f.requests.slice(calls).some(({ messages }) => messages.some((message) => text(message).includes("B_COMPLETED_AFTER_ASK"))),
    "the real Pi model request carries B's completion output");
  assert.equal(runner.cleanups, 0, "targeted stop with a terminal response keeps the runner");
  assert.equal(runner.interrupts, 0, "targeted stop never sends an interpreter-wide signal");
}

async function checkRetirement(s) {
  const { f, runner, a, b, calls } = s;
  assert.equal((await f.host.interruptCell({ kernelId: a.ask.kernelId, cellId: a.ask.cellId, cellOnly: true })).status, "requested");
  s.ack(await s.next("cancel", a)); // Acknowledged cancel but deliberately no terminal frame.
  await f.clock.advance(9999); // Default user interrupt policy: auto after 10,000 ms.
  assert.equal(runner.cleanups, 0, "cancel ACK is not an exit and grace has not elapsed");
  s.expectAsks(b);
  assert.deepEqual(s.native("kernel-cell-result"), []);
  await f.clock.advance(1);
  await until(() => runner.releases === 1, "auto-timeout did not cleanly retire the generation");
  s.expectAsks();
  assert.equal((await s.answer(b)).status, "unavailable");
  const receipts = await frozenReceipts(s, ["aborted", "aborted"]);
  const affectedCells = [a, b].map(({ cell, title }) => ({ ...cell, taskName: title }));
  for (const { data: { reason, result: { details } } } of receipts) {
    assert.equal(reason, "kernel 重启");
    assert.equal(details.cause, "interrupt-timeout");
    assert.equal(details.initiatorCellId, a.cell.cellId);
    assert.deepEqual(details.affectedCells, affectedCells);
  }
  s.held();
  await releaseNotices(s, []);
  assert.deepEqual(s.native("kernel-cell-result"), receipts, "dispatch must not rewrite or duplicate frozen receipts");
  assert.equal(f.provider.state.callCount, calls, "user-triggered retirement makes both terminal notices history-only");
  assert.equal(runner.cleanups, 1);
}

async function checkOperationCancel(s) {
  const { f, a, b } = s;
  const cancelled = await f.host.cancel({ operationId: b.run.operationId });
  assert.equal(cancelled.status, "requested");
  s.expectAsks(a, b);
  s.noExtraFrames();
  b.run.gate.release.resolve();
  await s.settle(b.run, "cancelled");
  s.expectAsks(a, b);
  for (const cell of [a, b]) await s.answerAndResume(cell);
  s.expectAsks();
  s.noExtraFrames();
  await within(f.host.close(), "handoff did not settle both cells");
  assert.equal(s.native("kernel-cell-result").length, 2, "both receipts precede the handoff return");
  await frozenReceipts(s, ["aborted", "aborted"]);
}

async function frozenReceipts(s, outcomes) {
  const { manager, a, b } = s;
  const receipts = await until(() => {
    const entries = s.native("kernel-cell-result");
    return entries.length >= 2 && entries;
  }, "both cells did not freeze a native receipt");
  const cells = [a, b];
  const identities = cells.map(({ cell, result }) => ({ ...cell, toolCallId: result.toolCallId,
    startedAt: result.details.startedAt, sessionId: manager.getSessionId() }));
  const key = ({ data: { cellId, kernelId, toolCallId, startedAt, sessionId } }) => ({ cellId, kernelId, toolCallId, startedAt, sessionId });
  assert.deepEqual(s.native("kernel-cell-open").map(key), identities);
  // Match by original tool call within the same native branch, not by current leaf or completion order.
  assert.deepEqual(cells.map(({ cell }) => key(receipts.find(({ data }) => data.cellId === cell.cellId))), identities);
  assert.equal(receipts.length, cells.length);
  for (const [index, { result }] of cells.entries()) {
    const parent = manager.getBranch().filter(({ type, message }) => type === "message" && message.role === "toolResult" && message.toolCallId === result.toolCallId);
    assert.deepEqual(parent.map(({ message }) => message), [result], "the original running tool result is unchanged and not duplicated");
    assert.equal(receipts.find(({ data }) => data.toolCallId === result.toolCallId).data.result.details.outcome, outcomes[index]);
  }
  return structuredClone(receipts);
}

async function releaseNotices(s, wakes) {
  const { f, runner, a, b } = s;
  b.run.gate.release.resolve();
  await s.settle(b.run);
  await until(() => !f.host.hasInFlightCell() && f.kernelWakeIds.length >= wakes.length && f.host.isIdle && f.session.isIdle,
    "released native notices and model turns did not settle");
  await f.clock.advance(30_000);
  const events = s.native("kernel-event");
  assert.deepEqual(events.map(({ details }) => details.eventId).sort(), [a, b].map(({ cell }) => `${cell.cellId}:finished`).sort(),
    "append exactly one finished notice per cell and discard both unpublished checkpoints");
  for (const { cell, result } of [a, b]) {
    const { details } = events.find(({ details }) => details.cellId === cell.cellId);
    assert.deepEqual([details.kernelId, details.toolCallId], [cell.kernelId, result.toolCallId]);
  }
  assert.deepEqual(f.kernelWakeIds, wakes);
  assert.equal(runner.starts, 1, "no replacement runner without an explicit execution request");
  s.noExtraFrames();
}

const identity = ({ generation, cellId }) => ({ kernelId: generation, cellId });
