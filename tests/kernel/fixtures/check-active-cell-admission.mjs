import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { DEFAULT_TERMINAL_OPTIONS } from "../../../src/config/terminal/terminal-options.ts";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../../../src/kernel/kernel-options.ts";
import { controlledRunner } from "./start-window-runner.mjs";

const busy = { code: "BUSY", transient: true };
const text = (reply) => reply.content[0].text;

function requireBusy(call, message, expected = busy) {
  return assert.rejects(Promise.race([call, setImmediate()]), expected, message);
}

export async function checkActiveCellAdmission(until) {
  let probeFreeze;
  const outputOptions = {
    ...DEFAULT_TERMINAL_OPTIONS,
    // Reenter the public tool from final output formatting, not from a snapshot state change.
    get outputBytes() {
      const probe = probeFreeze;
      probeFreeze = undefined;
      probe?.();
      return DEFAULT_TERMINAL_OPTIONS.outputBytes;
    },
  };
  const { owner, peer, frames, execute, end } = controlledOwner(8, outputOptions);
  const finished = [];
  const unsubscribe = owner.subscribeFinished((cell) => finished.push(cell));
  try {
    const ids = ["A", "B", "C", "D"];
    // Submit all four before giving the process any opportunity to initialize.
    const starting = Promise.all(ids.map((id) => execute(id)));
    void starting.catch(() => {});
    await until(() => frames("initialize").length === 1, "no initialize reached the cold peer");
    assert.equal(peer.starts, 1);
    assert.deepEqual(frames("execute"), [], "no execute precedes the initialize result");
    const startupWrites = peer.writes;
    await requireBusy(execute("cold-overflow"), "cold waiters occupy all four slots");
    assert.equal(peer.writes, startupWrites, "cold overflow does not write to the runner");
    end(frames("initialize")[0]);

    await until(() => frames("execute").length === 4, "four cold executes did not reach the runner");
    assert.equal(peer.starts, 1, "all four calls share a process");
    assert.equal(frames("initialize").length, 1, "all four calls share one initialize");
    const sent = frames("execute");
    for (const frame of sent) peer.admit(frame);
    const replies = await starting;
    assert.equal(new Set(sent.map(({ cellId }) => cellId)).size, 4);
    for (const [index, reply] of replies.entries()) {
      const frame = sent.find(({ title }) => title === ids[index]);
      assert(frame, `no execute for ${ids[index]}`);
      const { status, cell_id } = JSON.parse(text(reply));
      assert.deepEqual([status, cell_id, reply.details.toolCallId, reply.details.kernelId],
        ["running", frame.cellId, ids[index], frame.generation]);
    }
    const a = sent.find(({ title }) => title === "A");
    const b = sent.find(({ title }) => title === "B");
    peer.emit({ kind: "stream", cellId: a.cellId, stream: "stdout", text: "A-only\n" });
    peer.emit({ kind: "stream", cellId: b.cellId, stream: "stdout", text: "\x1b[31mB-only\x1b[0m\n" });
    const runningA = await owner.readCell(a.cellId);
    assert.equal(JSON.parse(text(runningA)).output, "A-only\n");

    const writes = peer.writes;
    await requireBusy(execute("overflow"), "yield does not release any of the four slots");
    assert.equal(finished.length, 0, "all four cells still run");
    let duringFreeze;
    probeFreeze = () => {
      duringFreeze = execute("during-freeze");
      void duringFreeze.catch(() => {});
    };
    end(b);
    await until(() => finished.length > 0, "B's terminal frame did not freeze a result");
    assert(duringFreeze, "the formatting probe must run inside B's result freeze");
    await requireBusy(duringFreeze, "terminal consumption alone does not release B while formatting");
    assert.equal(peer.writes, writes, "neither full-table attempt writes to the runner");
    assert.deepEqual(finished.map(({ cellId, toolCallId }) => [cellId, toolCallId]), [[b.cellId, "B"]]);
    const frozenB = await owner.readCell(b.cellId);
    assert.deepEqual(frozenB, finished[0].result);
    assert.equal(frozenB.details.outcome, "ok");
    assert.equal(text(frozenB), "B-only\n");
    assert.deepEqual(await owner.readCell(a.cellId), runningA, "B's terminal frame cannot change A's read");

    const replacing = execute("replacement");
    void replacing.catch(() => {});
    await until(() => frames("execute").length === 5, "B's frozen slot was not reusable");
    const next = frames("execute").at(-1);
    peer.admit(next);
    const replacement = await replacing;
    assert.equal(next.title, "replacement", "neither BUSY call was queued");
    assert.equal(next.generation, a.generation);
    assert.equal(JSON.parse(text(replacement)).cell_id, next.cellId);
    assert.deepEqual(await owner.readCell(a.cellId), runningA, "reusing B's slot does not displace A");
    await requireBusy(execute("full-again"), "B's completion released only one slot");
    await setImmediate();
    assert.equal(peer.writes, writes + 1, "only the explicit replacement reached the wire");
  } finally {
    unsubscribe();
    for (const cell of finished) cell.release();
    await owner.close();
  }
}

export async function checkRunnerBusy(until) {
  // Two ordinary window credits plus two control reserves; the table itself still has four slots.
  const { owner, peer, frames, execute, end } = controlledOwner(4);
  try {
    const first = execute("resident");
    void first.catch(() => {});
    await until(() => frames("initialize").length === 1, "no initialize reached the busy peer");
    end(frames("initialize")[0]);
    await until(() => frames("execute").length === 1, "resident did not reach the runner");
    const a = frames("execute")[0];
    peer.admit(a);
    await first;
    peer.emit({ kind: "stream", cellId: a.cellId, stream: "stdout", text: "resident-only\n" });
    const resident = await owner.readCell(a.cellId);
    const refusal = owner.executeForeground("runner-busy", { code: "42", title: "runner-busy" });
    void refusal.catch(() => {});
    await until(() => frames("execute").length === 2, "the runner, not the owner, must reject this execute");
    const b = frames("execute")[1];
    assert.notEqual(b.cellId, a.cellId);
    assert.notEqual(b.id, a.id);
    const writes = peer.writes;
    peer.emit({ kind: "cell_end", cellId: a.cellId, re: b.id, outcome: "error" });
    await setImmediate();
    assert.deepEqual(await owner.readCell(a.cellId), resident, "a sibling request ID cannot settle the resident cell");
    await requireBusy(execute("wrong-credit"), "the mismatched terminal frame cannot refund either credit");
    assert.equal(peer.writes, writes);

    peer.emit({ kind: "rejected", cellId: b.cellId, re: b.id, code: "BUSY" });
    await requireBusy(refusal, "only B receives the runner's rejection", { ...busy, submitted: false });
    assert.deepEqual(await owner.readCell(a.cellId), resident, "runner BUSY affects only the attempted cell");
    assert.equal(owner.getSnapshot().kernelId, a.generation);
    assert.equal(owner.getSnapshot().connectionStatus, "connected");
    await setImmediate();
    assert.equal(peer.writes, writes, "runner BUSY does not queue or replay the refused command");
    const retrying = execute("retry");
    void retrying.catch(() => {});
    await until(() => frames("execute").length === 3, "the refused request did not return its credit");
    const retry = frames("execute").at(-1);
    peer.admit(retry);
    await retrying;
    assert.equal(retry.title, "retry");
    assert.equal(retry.generation, a.generation, "a new explicit call still uses the same generation");
    assert.equal(peer.starts, 1);
    assert.equal(frames("initialize").length, 1);
    assert.deepEqual(await owner.readCell(a.cellId), resident);
  } finally { await owner.close(); }
}

function controlledOwner(maxRequests, outputOptions) {
  const peer = controlledRunner();
  const owner = createPythonTool({
    target: "owned", python: "/owned/python", cwd: "/tmp", acquire: async () => peer.lease,
    processWindow: { maxRequests, maxBytes: 2 * 1024 * 1024, maxFrameBytes: 1024 * 1024 },
    scoped: false, memoryMax: "4G", memorySwapMax: "0",
  }, {
    codeMode: true, runnerMaxActiveCells: 4, prelude: async () => "pass", outputOptions,
    executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, asyncExecution: true }),
  });
  return {
    owner, peer,
    frames: (kind) => peer.frames.map(({ frame }) => frame).filter((frame) => frame.kind === kind),
    execute: (id) => owner.tool.execute(id, { code: "42", title: id, yield_s: 0 }),
    end: ({ cellId, id }) => peer.emit({ kind: "cell_end", cellId, re: id, outcome: "ok" }),
  };
}
