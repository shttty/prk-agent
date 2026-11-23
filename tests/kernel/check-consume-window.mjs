import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { startWindowRunner } from "./fixtures/start-window-runner.mjs";

const KiB = 1024;
const execute = (cellId, code) => ({ kind: "execute", cellId, code, title: "Window test", defaultCellMode: "thread" });
const usage = (...frames) => ({ requests: frames.length, bytes: frames.reduce((sum, sent) => sum + sent.bytes, 0) });

// This is the process protocol seam; it exercises the window independently of the owner’s active-cell limit.
test("execute preserves room for cancel and callback consumption until cell_end", { timeout: 30_000 }, async (t) => {
  const { ctx, peer, processWindow, kernel, registerCell, close } = await startWindowRunner(t);
  const { send } = await import("../../src/kernel/protocol/send.ts");
  const { sendControl } = await import("../../src/kernel/protocol/send-control.ts");
  const { sendReply } = await import("../../src/kernel/callback/send-reply.ts");
  const window = kernel.window;
  try {
    // Each valid Python source is about 672 KiB on the wire, not 336 KiB (UTF-16 units).
    const large = `# ${"π".repeat(336 * KiB)}\n42`;
    const a = await submit(execute(randomUUID(), large));
    const b = await submit(execute(randomUUID(), large));
    assert.deepEqual(window.snapshot(), usage(a, b));
    assert(3 * Math.max(a.bytes, b.bytes) <= processWindow.maxBytes, "the third large frame fits without a byte reserve");
    await busy(execute(randomUUID(), large), "a third large execute would consume reserved bytes");

    // A third execution slot was available. Fill it with a small frame, leaving ample bytes.
    const c = await submit(execute(randomUUID(), "42"));
    const next = execute(randomUUID(), "42");
    const executions = usage(a, b, c);
    assert.deepEqual(window.snapshot(), executions);
    await busy(next, "another small execute would consume a reserved control slot");

    const cancelId = await sendControl(kernel, { kind: "cancel", cellId: a.frame.cellId }, new AbortController().signal, (id) => id);
    const cell = ctx.cells.get(b.frame.cellId);
    const reply = { ok: true, value: "é".repeat(32_757) }; // 65,514 value bytes plus the 22-byte JSON envelope.
    const replying = sendReply(ctx, kernel, cell, 1, reply);
    let settled = false;
    const markSettled = () => { settled = true; };
    void replying.then(markSettled, markSettled);
    await setImmediate();

    assert.equal(peer.frames.length, 5, "cancel and exactly one callback chunk reached the same runner");
    const [, , , cancel, chunk] = peer.frames;
    assert.deepEqual(cancel.frame, { kind: "cancel", cellId: a.frame.cellId, id: cancelId, generation: kernel.generation });
    const { data, id: chunkId, ...chunkHeader } = chunk.frame;
    assert.deepEqual(chunkHeader, { kind: "callback_reply_chunk", cellId: cell.id,
      generation: kernel.generation, requestId: 1, final: true });
    assert(Number.isSafeInteger(chunkId) && chunkId > cancelId, "callback chunk has a later wire request ID");
    const raw = Buffer.from(data, "base64");
    assert.equal(raw.length, 64 * KiB, "the full default raw chunk is usable");
    assert.deepEqual(JSON.parse(raw.toString("utf8")), reply);
    const withControls = usage(a, b, c, cancel, chunk);
    assert(withControls.bytes + c.bytes <= processWindow.maxBytes, "one more small execute fits by bytes even with both controls");
    assert.deepEqual(window.snapshot(), withControls);
    assert.equal(settled, false, "a processWrite response is not a callback consumption ACK");

    peer.emit({ kind: "ack", cellId: cancel.frame.cellId, re: cancel.frame.id });
    await setImmediate();
    assert.deepEqual(window.snapshot(), usage(a, b, c, chunk), "cancel ACK refunds only its own frame, not the cancelled execute");
    assert.equal(settled, false, "cancel ACK cannot resolve the callback reply");

    peer.emit({ kind: "ack", cellId: chunk.frame.cellId, re: chunk.frame.id });
    await setImmediate();
    assert.equal(settled, true, "the correlated ACK settles the callback reply");
    await replying;
    assert.deepEqual(window.snapshot(), executions, "both control ACKs leave all execute charges intact");
    await busy(next, "cancel ACK is not cell completion");

    peer.emit({ kind: "cell_end", cellId: a.frame.cellId, re: a.frame.id, outcome: "aborted" });
    assert.deepEqual(window.snapshot(), usage(b, c), "only the terminal frame releases the cancelled execute charge");
    const admitted = await submit(next);
    assert.deepEqual(window.snapshot(), usage(b, c, admitted));
  } finally {
    await close();
  }

  async function submit(payload) {
    const index = peer.frames.length;
    const id = send(kernel, payload);
    registerCell(payload.cellId, id);
    await setImmediate();
    assert.equal(peer.frames.length, index + 1, "one admitted execute reaches the runner");
    const sent = peer.frames[index];
    assert.deepEqual(sent.frame, { ...payload, generation: kernel.generation, id });
    return sent;
  }

  async function busy(payload, reason) {
    const before = window.snapshot();
    const writes = peer.writes;
    assert.throws(() => send(kernel, payload), { code: "BUSY", transient: true }, reason);
    await setImmediate();
    assert.equal(peer.writes, writes, "a rejected execute writes no bytes to the target");
    assert.deepEqual(window.snapshot(), before, "a rejected execute holds no window credit");
  }
});

test("accepted cells reuse each control slot only after consumption", { timeout: 30_000 }, async (t) => {
  const { ctx, kernel, peer, registerCell, close } = await startWindowRunner(t);
  const { send } = await import("../../src/kernel/protocol/send.ts");
  const { sendReply } = await import("../../src/kernel/callback/send-reply.ts");
  const { interrupt } = await import("../../src/kernel/process/interrupt.ts");
  try {
    const a = admit();
    const b = admit();
    const endedWhileWaiting = admit();
    await setImmediate();
    const executions = peer.frames.slice();
    callback(a);
    callback(b);
    const firstReply = await onlyNext(3, "callback_reply_chunk", a);
    a.callbacks.abort();
    await setImmediate();
    assert.equal(peer.frames.length, 4, "revoking the sender does not release an already-written reply slot");
    assert.deepEqual(kernel.window.snapshot(), usage(...executions, firstReply));
    ack(firstReply);
    const secondReply = await onlyNext(4, "callback_reply_chunk", b);
    assert.equal(secondReply.frame.requestId, 1);
    assert.equal(secondReply.frame.final, true);
    assert.deepEqual(JSON.parse(Buffer.from(secondReply.frame.data, "base64")), { ok: true, value: [] });
    ack(secondReply);
    await setImmediate();
    assert.deepEqual(kernel.window.snapshot(), usage(...executions));

    const stoppingA = cancel(a);
    const stoppingB = cancel(b);
    const firstCancel = await onlyNext(5, "cancel", a);
    assert.equal(peer.interrupts, 0, "a multi-slot cancel must not signal the entire group");
    ack(firstCancel);
    const secondCancel = await onlyNext(6, "cancel", b);
    assert.equal(peer.interrupts, 0, "the second cancel is also directed solely by cell ID");
    assert.deepEqual(kernel.window.snapshot(), usage(...executions, secondCancel));

    const stoppingEnded = cancel(endedWhileWaiting);
    end(endedWhileWaiting, "ok");
    await stoppingEnded;
    ack(secondCancel);
    await setImmediate();
    assert.equal(peer.frames.length, 7, "ending while waiting withdraws the unwritten cancel");
    assert.equal(peer.interrupts, 0, "an unwritten cancel has no external SIGINT");
    assert.deepEqual(kernel.window.snapshot(), usage(...executions.slice(0, 2)), "cancel ACKs did not confirm either execute");
    end(a, "aborted");
    end(b, "aborted");
    await Promise.all([stoppingA, stoppingB]);
    assert.equal(kernel.retired, false);
    assert.deepEqual(kernel.window.snapshot(), usage());

    const c = admit();
    const d = admit();
    await setImmediate();
    const reply = { ok: true, value: null };
    const written = assert.rejects(sendReply(ctx, kernel, c, 1, reply), /forced runner exit/);
    const waiting = assert.rejects(sendReply(ctx, kernel, d, 1, reply), /forced runner exit/);
    await onlyNext(9, "callback_reply_chunk", c);
    peer.emit({ kind: "fatal", cellId: null, error: "forced runner exit" });
    await Promise.all([written, waiting]);
    assert.equal(kernel.retired, true);
    assert.equal(peer.frames.length, 10, "retirement wakes both senders without writing the waiting frame");
    assert.deepEqual(kernel.window.snapshot(), usage());
  } finally { await close(); }

  function admit() {
    const id = randomUUID();
    const re = send(kernel, execute(id, "42"));
    return registerCell(id, re);
  }
  // All admitted owners stay registered together while the real receiver routes each frame.
  function callback(cell) {
    peer.emit({ kind: "callback_chunk", cellId: cell.id, requestId: 1, channel: "describe", data: "e30=", final: true });
  }
  function cancel(cell) {
    const stopping = interrupt(ctx, cell, "test cancel");
    stopping.catch(() => {});
    return stopping;
  }
  function end(cell, outcome) {
    peer.emit({ kind: "cell_end", cellId: cell.id, re: cell.requestId, outcome });
  }
  function ack({ frame }) { peer.emit({ kind: "ack", cellId: frame.cellId, re: frame.id }); }
  async function onlyNext(index, kind, cell) {
    await setImmediate();
    assert.equal(kernel.retired, false, "contention does not retire the generation");
    assert.equal(peer.frames.length, index + 1, "only one control frame reaches the runner per ACK");
    const sent = peer.frames[index];
    assert.equal(sent.frame.kind, kind);
    assert.equal(sent.frame.cellId, cell.id);
    assert(sent.frame.id > peer.frames[index - 1].frame.id, "wire IDs increase in write order");
    return sent;
  }
});

test("an expired never interrupt upgrades synchronously and reuses the original delivery", { timeout: 30_000 }, async (t) => {
  const { ctx, kernel, peer, registerCell, close } = await startWindowRunner(t);
  const { send } = await import("../../src/kernel/protocol/send.ts");
  const { interrupt } = await import("../../src/kernel/process/interrupt.ts");
  let now = 0;
  ctx.clock = { now: () => now, schedule: () => () => {} }; // The clock can pass the deadline before the timer callback runs.
  ctx.hooks.executionPolicy = () => ({ interruptTimeoutMs: 100, interruptRestart: now === 0 ? "never" : "auto" });
  try {
    const id = randomUUID();
    const cell = registerCell(id, send(kernel, execute(id, "42")));
    const delivery = interrupt(ctx, cell, "test cancel");
    assert.equal(cell.interruption.restart, "never");
    await delivery;
    now = 101;
    assert.equal(interrupt(ctx, cell, "repeat with default"), delivery);
    assert.equal(kernel.retired, false, "an omitted policy does not upgrade the stop");
    assert.equal(interrupt(ctx, cell, "upgrade", "auto"), delivery);
    assert.equal(cell.interruption.deadline, 100);
    assert.equal(kernel.retired, true, "upgrade fences admission before returning");
    assert.equal(kernel.retirementReceipt.cause, "interrupt-timeout");
    const retirement = kernel.stopping;
    assert(retirement, "upgrade installs the cleanup promise synchronously");
    assert.equal(close(), retirement, "the generation has one cleanup promise");
    await retirement;
    assert.deepEqual(peer.frames.map(({ frame }) => frame.kind), ["execute", "cancel"]);
    assert.equal(peer.cleanups, 1);
  } finally { await close(); }
});
