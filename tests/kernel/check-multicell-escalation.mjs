import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";

const home = await mkdtemp("/tmp/prk-s08-");
const prk = join(home, "prk"), tmp = join(home, "tmp");
Object.assign(process.env, { HOME: home, PRK_HOME: prk, TMPDIR: tmp, XDG_RUNTIME_DIR: tmp,
  PI_CODING_AGENT_DIR: join(prk, "agent"), PRK_CODING_AGENT_DIR: join(prk, "agent") });
await mkdir(tmp);
const { createRoutingGateway, text, until } = await import("./fixtures/create-routing-gateway.mjs");
const clock = monotonicClock();
let cleanup = Promise.withResolvers();
let f;
try {
  f = await createRoutingGateway(home, process.env.PI_TEST_PYTHON ?? "/usr/bin/python3", {}, {
    clock, kernelPolicy: { interruptTimeoutMs: 100 }, runner: { confirmCleanup: () => cleanup.promise },
  });
  const { peer, kernel } = f;
  const emit = ({ cellId, generation }, data) => peer.emit({ cellId, generation, ...data });
  const end = (frame, outcome = "ok") => emit(frame, { kind: "cell_end", re: frame.id, outcome });
  const ack = (frame) => emit(frame, { kind: "ack", re: frame.id });
  const init = async () => { const frame = await f.next("initialize"); end(frame); return frame.generation; };
  const spawn = async (title, mode = "thread", cold = false) => {
    const wait = await f.turn("kernel_code", { code: title, title, yield_s: 0 });
    if (cold) await init();
    const frame = await f.next("execute");
    emit(frame, { kind: "cell_admitted", re: frame.id, mode });
    assert.equal(JSON.parse(text(await wait())).cell_id, frame.cellId);
    return frame;
  };
  const stop = (cell, restart) => f.turn("kernel_interrupt", { cell_id: cell.cellId, ...(restart && { restart }) });
  const saved = (cell) => until(() => f.result(cell).result, `frozen result ${cell.code}`);
  const finished = (cell) => until(() => f.finished(cell), `finished message ${cell.code}`);
  const affected = (...cells) => cells.map(({ generation, cellId, title }) => ({ kernelId: generation, cellId, taskName: title }));
  const advice = /下次请用 `mode:"isolated"`/;
  const noAdvice = (value) => {
    assert.equal(Object.hasOwn(value.details, "suggestedMode"), false);
    assert.doesNotMatch(text(value), advice);
  };

  const a = await spawn("A", "thread", true);
  const b = await spawn("B", "isolated");
  const ask = Buffer.from(JSON.stringify({ name: "ask", args: { questions: [{ id: "a", question: "A?", options: [{ label: "Yes" }] }] } })).toString("base64");
  emit(a, { kind: "callback_chunk", requestId: 1, channel: "gateway", data: ask, final: true });
  const card = await until(() => f.asks().find(({ cellId }) => cellId === a.cellId), "A's ask");
  const first = await stop(a, "never");
  ack(await f.next("cancel", a));
  const observedAt = 42;
  const blockedAt = [{ step: "probe", observedAt, status: "blocked", evidence: "controlled reader" }];
  emit(a, { kind: "cell_state", state: "stopping", blockedAt, observedAt });
  await until(() => !f.asks().some(({ id }) => id === card.id), "A's ask to be revoked");
  assert.equal((await f.answer(card, 0)).status, "unavailable");
  emit(a, { kind: "callback_chunk", requestId: 2, channel: "describe", data: "e30=", final: true });
  const snapshot = { status: "stopping", cell_id: a.cellId, restart: "never", blockedAt, observedAt,
    peers: [{ cell_id: b.cellId, title: "B", state: "running" }] };
  assert.deepEqual(await kernel.requestCellInterrupt(a.cellId, "never"), snapshot, "repeat never is immediate");
  await clock.advance(100);
  assert.deepEqual(JSON.parse(text(await first())), snapshot);
  assert.equal((await kernel.readCell(a.cellId)).details.stopping.restart, "never");
  assert.deepEqual(await kernel.requestCellInterrupt(a.cellId), snapshot, "omission keeps the first policy after its deadline");
  assert.equal(peer.cleanups, 0);
  assert.equal(peer.interrupts, 0);
  await assert.rejects(kernel.tool.execute("full", { code: "not sent" }), { code: "BUSY", transient: true });
  f.noExtraFrames();

  const switched = JSON.parse(text(await (await stop(a, "auto"))()));
  assert.deepEqual(switched, { status: "requested", cell_id: a.cellId, restart: "auto", grace_ms: 0, peers: snapshot.peers.map((p) => ({ ...p, state: "stopping" })) });
  await until(() => peer.cleanups === 1, "auto retirement");
  const nowWhileRetiring = kernel.requestCellInterrupt(b.cellId, "now");
  assert.equal(peer.releases, 0, "neither cancel ACK nor retirement fence proves exit");
  cleanup.resolve(0);
  assert.deepEqual((await nowWhileRetiring).affectedCells, affected(a, b));
  const aResult = await saved(a), bResult = await saved(b);
  assert.equal(aResult.details.outcome, "aborted");
  assert.equal(aResult.details.cause, "interrupt-timeout");
  assert.equal(aResult.details.initiatorCellId, a.cellId);
  assert.deepEqual(aResult.details.affectedCells, affected(a, b));
  assert.equal(aResult.details.suggestedMode, "isolated");
  assert.match(text(aResult), advice);
  const read = await (await f.turn("kernel_read", { cell_id: a.cellId }))();
  assert.deepEqual(read.content, aResult.content);
  assert.deepEqual(read.details, aResult.details);
  const aFinished = await finished(a);
  assert.equal(aFinished.details.suggestedMode, "isolated");
  assert.match(text(aFinished), advice);
  assert.equal(bResult.details.outcome, "aborted");
  assert.deepEqual(bResult.details.affectedCells, affected(a, b));
  noAdvice(bResult);
  noAdvice(await finished(b));
  assert.equal(peer.starts, 1, "retirement cannot start a replacement");
  assert.equal(peer.cleanups, 1);
  assert.equal(peer.releases, 1);
  f.noExtraFrames();

  // A thread which has not yielded still returns the same formatted timeout result in the foreground.
  const controller = new AbortController();
  const foreground = kernel.tool.execute("foreground", { code: "foreground thread", title: "F", yield_s: 1 }, controller.signal);
  await init();
  const frame = await f.next("execute");
  emit(frame, { kind: "cell_admitted", re: frame.id, mode: "thread" });
  const c = await spawn("C");
  const stopping = await stop(c);
  // Leave the cancel slot occupied; foreground cancellation must still start its own clock.
  await f.next("cancel", c);
  assert.equal(JSON.parse(text(await stopping())).grace_ms, 100);
  controller.abort();
  await clock.advance(99);
  assert.equal(peer.cleanups, 1);
  end(c);
  assert.equal((await saved(c)).details.outcome, "ok");
  await clock.advance(1);
  const foregroundResult = await foreground;
  assert.equal(foregroundResult.details.suggestedMode, "isolated");
  assert.equal(foregroundResult.details.outcome, "aborted");
  assert.equal(foregroundResult.details.initiatorCellId, frame.cellId);
  assert.deepEqual(foregroundResult.details.affectedCells, affected(frame));
  assert.match(text(foregroundResult), advice);
  assert.equal(peer.cleanups, 2);
  f.noExtraFrames();

  const d = await spawn("D", "thread", true);
  const e = await spawn("E", "isolated");
  const pendingAuto = await stop(d, "auto");
  ack(await f.next("cancel", d));
  assert.equal(JSON.parse(text(await pendingAuto())).grace_ms, 100);
  await clock.advance(40);
  const repeated = JSON.parse(text(await (await stop(d))()));
  assert.equal(repeated.grace_ms, 60, "repeat auto uses the first acceptance time");
  cleanup = Promise.withResolvers();
  const pendingNow = await stop(d, "now");
  await until(() => peer.cleanups === 3, "explicit now retirement");
  const alsoNow = kernel.requestCellInterrupt(e.cellId, "now");
  await clock.advance(100);
  assert.equal(peer.cleanups, 3);
  cleanup.resolve(0);
  const receipt = JSON.parse(text(await pendingNow()));
  assert.equal(receipt.cause, "interrupt-now");
  assert.equal(receipt.initiatorCellId, d.cellId);
  assert.deepEqual(receipt.affectedCells, affected(d, e));
  assert.deepEqual((await alsoNow).affectedCells, receipt.affectedCells);
  for (const cell of [d, e]) noAdvice(await saved(cell));

  const g = await spawn("G", "thread", true);
  const h = await spawn("H", "async");
  const stale = await (await stop(e, "now"))();
  assert.equal(stale.isError, true, "old IDs cannot retire the new generation");
  await assert.rejects(kernel.requestCellInterrupt(e.cellId, "auto"), { code: "NOT_FOUND" });
  assert.equal(peer.cleanups, 3);
  cleanup = Promise.withResolvers();
  const reset = await f.turn("kernel_code", { code: "new execution", reset: true, yield_s: 1 });
  await until(() => peer.cleanups === 4, "busy reset cleanup");
  await assert.rejects(kernel.tool.execute("duplicate-reset", { code: "", reset: true }), { code: "BUSY", submitted: false });
  assert.equal(peer.starts, 4, "reset must wait for the old generation's cleanup proof");
  cleanup.resolve(0);
  const resetGeneration = await init();
  const afterReset = await f.next("execute");
  assert.notEqual(resetGeneration, g.generation);
  assert.equal(afterReset.generation, resetGeneration);
  assert.equal(afterReset.code, "new execution");
  end(afterReset);
  const resetResult = await reset();
  assert.equal(resetResult.details.reset.cause, "reset");
  assert.deepEqual(resetResult.details.reset.affectedCells, affected(g, h));
  noAdvice(resetResult);
  for (const cell of [g, h]) {
    const result = await saved(cell);
    assert.equal(result.details.outcome, "aborted");
    assert.equal(result.details.cause, "reset");
    noAdvice(result);
    noAdvice(await finished(cell));
  }
  f.noExtraFrames();
  console.log("PASS multicell escalation: never, auto, now and full-generation reset");
} finally {
  cleanup.resolve(0);
  await f?.close();
  await rm(home, { recursive: true, force: true });
}

function monotonicClock() {
  let now = 0;
  const timers = new Set();
  return {
    now: () => now,
    schedule(fn, ms) {
      const timer = { fn, due: now + ms };
      timers.add(timer);
      return () => timers.delete(timer);
    },
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        const next = [...timers].filter(({ due }) => due <= target).sort((a, b) => a.due - b.due)[0];
        if (!next) break;
        timers.delete(next);
        now = next.due;
        next.fn();
        await setImmediate();
      }
      now = target;
      await setImmediate();
    },
  };
}
