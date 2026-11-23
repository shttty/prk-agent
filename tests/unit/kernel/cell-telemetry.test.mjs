import assert from "node:assert/strict";
import test from "node:test";
import { publish } from "../../../src/kernel/telemetry/publish.ts";
import { previewCell } from "../../../src/kernel/cell/preview-cell.ts";
import { setBudget } from "../../../src/kernel/cell/set-budget.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../../src/config/terminal/terminal-options.ts";

const identity = { kernelId: "kernel-a", cellId: "cell-a", toolCallId: "tool-a", startedAt: 100 };

test("yielded telemetry publishes bounded output and explicit ask transitions", () => {
  const cell = { ...identity, id: identity.cellId, submittedAt: 0, activeMs: 0, activeSince: 0, yielded: true, userStopped: false, mode: "thread",
    output: { text: "HEAD\n", tail: "TAIL\n", omittedChars: 800, truncated: true }, images: [{ data: "not-in-snapshot" }], omittedImages: 1,
    callbacks: new AbortController(), timeoutMs: 0 };
  const ctx = { snapshot: { state: "busy", kernelId: cell.kernelId }, cells: new Map([[cell.id, cell]]), pendingFinished: new Map(), listeners: new Set(),
    hooks: { outputOptions: DEFAULT_TERMINAL_OPTIONS }, clock: { now: () => 500 } };
  publish(ctx, {});
  const [active] = ctx.snapshot.activeCells;
  assert.equal(active.cellId, identity.cellId);
  assert.equal(active.output.includes("HEAD"), true);
  assert.equal(active.output.includes("TAIL"), true);
  assert.equal(active.truncated, true);
  assert.equal(active.elapsedMs, 500);
  assert.equal(active.activeMs, 500);
  assert.equal(active.waitingForAsk, false);
  assert.equal(active.imageCount, 2);
  assert.equal(JSON.stringify(active).includes("not-in-snapshot"), false);
  cell.pendingCallback = { name: "ask", status: "error" };
  setBudget(ctx, cell, true);
  assert.equal(ctx.snapshot.activeCells[0].waitingForAsk, true);
  assert.equal(ctx.snapshot.activeCells[0].activeMs, 500);
  cell.pendingCallback = undefined;
  setBudget(ctx, cell, false);
  assert.equal(ctx.snapshot.activeCells[0].waitingForAsk, false);
  cell.userStopped = true;
  assert.equal(previewCell(ctx, cell.id), undefined);
  publish(ctx, {});
  assert.equal(ctx.snapshot.activeCells[0].cellId, cell.id, "user stop remains visible until terminal settlement");
  ctx.cells.delete(cell.id);
  publish(ctx, { state: "idle" });
  assert.deepEqual(ctx.snapshot.activeCells, []);
});
