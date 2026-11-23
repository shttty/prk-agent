import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { CODE_MIMES } from "../../../src/codemode/kernel-protocol/kernel-protocol-schema.ts";
import { controlledRunner } from "./start-window-runner.mjs";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../../../src/kernel/kernel-options.ts";

export async function checkCellClockIsolation(fakeClock, until) {
  const clock = fakeClock();
  const peer = controlledRunner();
  const owner = createPythonTool({
    target: "owned", python: "/owned/python", cwd: process.env.TMPDIR ?? "/tmp", acquire: async () => peer.lease,
    processWindow: { maxRequests: 8, maxBytes: 2 * 1024 * 1024, maxFrameBytes: 1024 * 1024 },
    scoped: false, memoryMax: "4G", memorySwapMax: "0",
  }, { runnerMaxActiveCells: 4, prelude: async () => "pass", clock }, { executionTimeoutMs: 3_700_000 });
  const reminders = [], finished = [], published = [];
  owner.subscribeReminders(({ cellId, dueMs }) => reminders.push([cellId, dueMs]));
  const offFinished = owner.subscribeFinished((cell) => { finished.push(cell); cell.release(); });
  const offSnapshot = owner.subscribe((snapshot) => published.push(snapshot));
  const answer = Promise.withResolvers(), entered = Promise.withResolvers();
  const sdk = { async executeTool(name) {
    assert.equal(name, "ask");
    entered.resolve();
    await answer.promise;
    return { isError: false, result: { content: [{ type: "text", text: "answer" }] } };
  } };
  const frameFor = (predicate) => until(() => peer.frames.some(({ frame }) => predicate(frame)), "expected runner command")
    .then(() => peer.frames.find(({ frame }) => predicate(frame)).frame);
  const emit = (cell, frame) => peer.emit({ cellId: cell.cellId, ...frame });
  const end = (cell, outcome = "ok") => emit(cell, { kind: "cell_end", re: cell.id, outcome });
  const active = () => owner.getSnapshot().activeCells;
  const execute = (title, context, onUpdate) => owner.tool.execute(`tool-${title}`, { code: "42", title, yield_s: 0 }, undefined, onUpdate, context);

  try {
    const starting = execute("A", sdk, () => { void clock.advance(20_000); });
    void starting.catch(() => {});
    end(await frameFor(({ kind }) => kind === "initialize"));
    const a = await frameFor(({ title }) => title === "A");
    emit(a, { kind: "cell_admitted", re: a.id, generation: `${a.generation}-stale`, mode: "isolated" });
    emit(a, { kind: "cell_admitted", re: a.id + 1, mode: "isolated" });
    // Advance the clock from the real progress callback between admission and ask in one receive batch.
    peer.emitBatch(
      { kind: "cell_admitted", cellId: a.cellId, re: a.id, mode: "async" },
      { kind: "cell_admitted", cellId: a.cellId, re: a.id, mode: "isolated" },
      { kind: "display", cellId: a.cellId, data: { [CODE_MIMES.progress]: { text: "before ask" } }, metadata: {} },
      { kind: "callback_chunk", cellId: a.cellId, requestId: 1, channel: "gateway", final: true,
        data: Buffer.from(JSON.stringify({ name: "ask", args: {} })).toString("base64") },
    );
    await starting;
    await entered.promise;
    const bStarted = execute("B");
    void bStarted.catch(() => {});
    const b = await frameFor(({ title }) => title === "B");
    emit(b, { kind: "cell_admitted", re: b.id, mode: "thread" });
    await bStarted;
    assert.equal(owner.getSnapshot().language, "python");
    assert.deepEqual(active().map(({ cellId, toolCallId, taskName, waitingForAsk, deadlineRemainingMs }) =>
      [cellId, toolCallId, taskName, waitingForAsk, deadlineRemainingMs]), [
      [a.cellId, "tool-A", "A", true, 3_680_000], [b.cellId, "tool-B", "B", false, 3_700_000],
    ]);
    assert.deepEqual(active().map(({ mode }) => mode), ["async", "thread"], "only the first matching runner mode belongs to each cell");
    assert.equal(Object.hasOwn(owner.getSnapshot(), "activeCell"), false, "no scalar compatibility projection");

    let advanced = 0;
    const due = [60_000, 300_000, 900_000, 1_800_000, 3_600_000];
    for (const [index, next] of due.entries()) {
      await clock.advance(next - advanced - 1);
      assert.equal(reminders.length, index);
      await clock.advance(1);
      assert.deepEqual(reminders, due.slice(0, index + 1).map((at) => [b.cellId, at]));
      advanced = next;
    }
    const blockedAt = [{ step: "timer", observedAt: 42, status: "waiting", evidence: "sleep", remainingMs: 500 }];
    emit(b, { kind: "cell_state", state: "stopping", blockedAt, observedAt: 42 });
    assert.deepEqual(active().map(({ cellId, status, blockedAt, activeMs }) => [cellId, status, blockedAt, activeMs]), [
      [a.cellId, "running", undefined, 20_000], [b.cellId, "stopping", blockedAt, 3_600_000],
    ]);
    end(b);
    await until(() => active().length === 1, "B did not leave its slot after freezing");
    assert.deepEqual(active().map(({ cellId, waitingForAsk }) => [cellId, waitingForAsk]), [[a.cellId, true]]);
    assert.deepEqual(published.at(-1).activeCells, active(), "the same removal is published incrementally");
    assert.deepEqual(finished.map(({ cellId, activeMs }) => [cellId, activeMs]), [[b.cellId, 3_600_000]]);
    assert.equal(finished[0].result.details.mode, "thread");

    answer.resolve();
    const reply = await frameFor(({ kind, cellId }) => kind === "callback_reply_chunk" && cellId === a.cellId);
    emit(a, { kind: "ack", re: reply.id });
    assert.equal(active()[0].waitingForAsk, false);
    assert.equal(active()[0].deadlineRemainingMs, 3_680_000);
    await clock.advance(39_999);
    assert.equal(reminders.length, 5, "ask consumes none of A's original 40s to the first reminder");
    await clock.advance(1);
    assert.deepEqual(reminders.slice(5), [[a.cellId, 60_000]]);
    end(a);
    await until(() => owner.getSnapshot().state === "idle", "A did not finish");
    assert.deepEqual(active(), []);
    assert.deepEqual(finished.map(({ cellId, activeMs }) => [cellId, activeMs]), [[b.cellId, 3_600_000], [a.cellId, 60_000]]);
    assert.deepEqual(clock.delays(), [], "each completion disarms only its own clock");
  } finally {
    answer.resolve();
    offFinished();
    offSnapshot();
    await owner.close();
  }
  await checkAdmissionClock(fakeClock, until);
}

async function checkAdmissionClock(fakeClock, until) {
  const clock = fakeClock(), peer = controlledRunner();
  const owner = createPythonTool({
    target: "owned", python: "/owned/python", cwd: "/tmp", acquire: async () => peer.lease,
    processWindow: { maxRequests: 3, maxBytes: 2 * 1024 * 1024, maxFrameBytes: 1024 * 1024 },
    scoped: false, memoryMax: "4G", memorySwapMax: "0",
  }, { codeMode: true, prelude: async () => "pass", runnerMaxActiveCells: 2, clock, executionPolicy: () => ({
    ...DEFAULT_KERNEL_EXECUTION_POLICY, reminderLadderMs: [100],
  }) }, { executionTimeoutMs: 150 });
  const opens = [], reminders = [];
  const history = { beforeYield: ({ cellId }) => opens.push(cellId) };
  owner.subscribeReminders(({ cellId, dueMs }) => reminders.push([cellId, dueMs]));
  owner.subscribeFinished((cell) => cell.release());
  const execute = (title, yield_s = 0) => owner.executeOwned(history, title, { code: "42", title, yield_s });
  const frames = (kind) => peer.frames.map(({ frame }) => frame).filter((frame) => frame.kind === kind);
  const command = async (kind, title) => {
    const find = () => frames(kind).find((frame) => title === undefined || frame.title === title);
    await until(find, `expected ${title ?? kind}`);
    return find();
  };
  const event = ({ cellId, id }, kind, fields) => ({ kind, cellId, re: id, ...fields });
  const admission = (frame, fields) => event(frame, "cell_admitted", { mode: "isolated", ...fields });
  const terminal = (frame, outcome = "ok") => event(frame, "cell_end", { outcome });

  try {
    const waiting = execute("late", 0.05);
    void waiting.catch(() => {});
    const init = await command("initialize");
    peer.emit(terminal(init));
    const late = await command("execute", "late");
    await clock.advance(500);
    assert.deepEqual(opens, [], "submission must not open a background cell");
    peer.emitBatch(admission(late, { generation: `${late.generation}-stale` }),
      admission(late, { cellId: init.cellId }), admission(late, { re: init.id }));
    await clock.advance(500);
    assert.deepEqual(opens, [], "generation, cell and request must all match");
    assert.deepEqual(reminders, []);
    assert.deepEqual(frames("cancel"), [], "preadmission time must not count against the hard limit");

    peer.admit(late, "async");
    await clock.advance(49);
    assert.deepEqual(opens, [], "foreground wait starts at admission");
    peer.admit(late, "isolated");
    await clock.advance(1);
    assert.deepEqual(opens, [late.cellId], "duplicate admission does not move the foreground deadline");
    assert.equal(JSON.parse((await waiting).content[0].text).status, "running");
    assert.equal(owner.getSnapshot().activeCells[0].mode, "async");
    await assert.rejects(Promise.race([execute("no-credit"), setImmediate()]), { code: "BUSY", transient: true });
    await clock.advance(49);
    assert.deepEqual(reminders, []);
    await clock.advance(1);
    assert.deepEqual(reminders, [[late.cellId, 100]]);
    await clock.advance(49);
    assert.deepEqual(frames("cancel"), []);
    await clock.advance(1);
    const cancel = await command("cancel");
    assert.equal(cancel.cellId, late.cellId);
    peer.emit(event(cancel, "ack"));
    peer.emit(terminal(late, "aborted"));
    await until(() => owner.getSnapshot().state === "idle", "late cell did not settle");

    const refused = assert.rejects(execute("refused"), { code: "BUSY", transient: true, submitted: false });
    const rejection = await command("execute", "refused");
    await clock.advance(500);
    peer.emitBatch(event(rejection, "rejected", { code: "BUSY" }), admission(rejection));
    await refused;
    for (const title of ["ended-before-admission", "ended-with-admission", "retired-before-admission"]) {
      const done = execute(title);
      void done.catch(() => {});
      const frame = await command("execute", title);
      assert.equal(frame.generation, late.generation, "each terminal response returns the only execute credit");
      await clock.advance(500);
      assert.deepEqual(opens, [late.cellId]);
      if (title === "ended-before-admission") peer.emitBatch(terminal(frame), admission(frame));
      else if (title === "ended-with-admission") peer.emitBatch(admission(frame), terminal(frame));
      else peer.exit(17);
      const reply = await done;
      assert.equal(reply.details.outcome, title === "retired-before-admission" ? "unknown" : "ok");
      assert.deepEqual(opens, [late.cellId], `${title} must not write open`);
      assert.deepEqual(clock.delays(), []);
    }
  } finally { await owner.close(); }
}
