import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { listCellDeliveries } from "../../../src/sessions/history/kernel-cells/read-deliveries.ts";
import { readSavedCellResult } from "../../../src/sessions/history/kernel-cells/read-result.ts";
import { createYieldedSdkCell, text, until, within } from "./create-yielded-sdk-cell.mjs";
import { controlledRunner } from "./start-window-runner.mjs";

export async function checkSharedCellSettlement(target) {
  const runner = controlledRunner();
  const fixtureTarget = { ...target, runtime: { ...target.runtime, acquire: async () => runner.lease } };
  const manager = SessionManager.create(target.tempRoot, join(target.tempRoot, "settlement-history"));
  const f = await createYieldedSdkCell(fixtureTarget, { ensure: false, sessionManager: manager, runnerMaxActiveCells: 2 });
  const execute = () => runner.frames.map(({ frame }) => frame).filter(({ kind }) => kind === "execute");
  const admit = async (index) => runner.admit(await until(() => execute()[index], "runner did not receive execute"));
  const end = ({ cellId, id }) => runner.emit({ kind: "cell_end", cellId, re: id, outcome: "ok" });
  const settled = async (run) => {
    assert.equal((await within(run.completion, "host operation did not complete")).status, "completed");
    await until(() => f.host.isIdle && f.session.isIdle, "shared settlement SDK did not go idle");
  };

  const runA = await f.start("print('settlement output A')");
  end(await until(() => runner.frames.find(({ frame }) => frame.kind === "initialize")?.frame, "runner did not receive initialize"));
  await admit(0);
  const a = await f.running(runA);
  await settled(runA);
  const runB = await f.start("print('settlement output B')", { settle: true });
  try {
    await admit(1);
    const b = await f.running(runB);
    await within(runB.gate.entered.promise, "shared agent_settled gate did not open");
    const { idle, idleWaitPending, calls } = runB.gate.window;
    assert.equal(idle, true);
    assert.equal(idleWaitPending, true);
    const ids = [a.cell.cellId, b.cell.cellId];
    assert.notEqual(ids[0], ids[1]);
    assert.equal(a.cell.kernelId, b.cell.kernelId);
    assert.deepEqual(f.owner.getSnapshot().activeCells.map(({ cellId }) => cellId), ids, "A and B are both yielded on entry");
    const identity = ({ cellId, kernelId, toolCallId, startedAt, sessionId }) => ({ cellId, kernelId, toolCallId, startedAt, sessionId });
    const identities = [a, b].map(({ cell, result }) => ({ ...cell, toolCallId: result.toolCallId,
      startedAt: result.details.startedAt, sessionId: f.session.sessionId }));
    assert.deepEqual(cellEntries(manager, "kernel-cell-open").map(({ data }) => identity(data)), identities);
    assert.deepEqual(cellEntries(manager, "kernel-cell-result"), []);

    await f.clock.advance(1000);
    assert.deepEqual(f.reminders.map(({ cellId, kernelId, dueMs }) => [cellId, kernelId, dueMs]),
      identities.map(({ cellId, kernelId }) => [cellId, kernelId, 1000]), "both first checkpoints became due inside the same hook");
    const frames = execute();
    assert.deepEqual(frames.map(({ cellId, generation }) => ({ cellId, kernelId: generation })), [a.cell, b.cell]);
    for (const [index, letter] of ["A", "B"].entries()) {
      runner.emit({ kind: "stream", cellId: ids[index], stream: "stdout", text: `settlement output ${letter}\n` });
      end(frames[index]);
    }
    await until(() => f.owner.getSnapshot().state === "idle" && cellEntries(manager, "kernel-cell-result").length === 2,
      "both cells did not freeze and record their result on the held branch");
    assert.deepEqual(f.owner.getSnapshot().activeCells, []);
    const resultEntries = cellEntries(manager, "kernel-cell-result");
    assert.deepEqual(resultEntries.map(({ data }) => identity(data)), identities);
    assert.equal((await f.host.interruptCell({ ...a.cell, cellOnly: true })).status, "requested", "user stop still targets frozen A");
    assert.deepEqual(cellEntries(manager, "kernel-event"), [], "both checkpoints and both finished messages are absent before release");
    for (const id of ids) assert.deepEqual(f.nativeEvents(id), [], "nothing reached native history while the fence was held");
    assert.deepEqual(f.kernelWakeIds, []);
    assert.equal(f.provider.state.callCount, calls);

    runB.gate.release.resolve();
    await settled(runB);
    await until(() => ids.every((id) => f.nativeEvents(id, "finished").length === 1)
      && f.provider.state.callCount > calls && f.host.isIdle && f.session.isIdle, "shared finished messages or native wake did not settle");
    await f.clock.advance(30_000);

    // Preview can still find frozen B while its finished dispatch is behind the fence.
    assert.deepEqual(f.nativeEvents(b.cell.cellId, "checkpoint"), [], "frozen B must not dispatch its stale checkpoint");
    assert.deepEqual(f.nativeEvents(a.cell.cellId, "checkpoint"), [], "user-stopped A must not dispatch its stale checkpoint");
    const finished = cellEntries(manager, "kernel-event");
    assert.deepEqual(finished.map(({ details }) => identity(details)), identities);
    assert.deepEqual(finished.map(({ details }) => [details.kind, details.status, details.outcome, details.eventId]),
      ids.map((id) => ["finished", "finished", "ok", `${id}:finished`]));
    assert.equal(finished[0].details.reason, "Stopped by the user.");
    assert.notEqual(finished[1].details.reason, "Stopped by the user.");
    assert.deepEqual(f.kernelWakeIds, [`${b.cell.cellId}:finished`], "only B's finished message starts a turn");
    assert.equal(f.provider.state.callCount, calls + 1, "A is history-only and B causes exactly one model request");
    assert.deepEqual(cellEntries(manager, "kernel-cell-result"), resultEntries, "release does not append duplicate receipts");

    for (const [index, cell] of [a, b].entries()) {
      const output = `settlement output ${index === 0 ? "A" : "B"}\n`;
      assert.deepEqual(finished[index].content.slice(1), [{ type: "text", text: output }]);
      const read = await f.start({ cell_id: cell.cell.cellId }, { tool: "kernel_read" });
      await settled(read);
      const parent = f.parent(read.id);
      assert.equal(parent.isError, false);
      assert.equal(parent.details.kernelId, cell.cell.kernelId);
      assert.equal(parent.details.outcome, "ok", "stopping a frozen result does not rewrite its outcome");
      assert.equal(text(parent), output, "kernel_read resolves only the requested cell's frozen output");
      assert.deepEqual(parent.content, resultEntries[index].data.result.content);
      assert.deepEqual(parent.details, resultEntries[index].data.result.details);
      const parents = manager.getBranch().filter(({ type, message }) => type === "message" && message.role === "toolResult"
        && message.toolCallId === cell.result.toolCallId);
      assert.deepEqual(parents.map(({ message }) => message), [cell.result], "no replacement or second parent tool result");
    }
    assert.equal(execute().length, 2, "reading both receipts does not rerun either cell");
    assert.deepEqual(f.errors, []);

    await checkMissingResultAfterReopen(target, manager, resultEntries[0], b.cell.cellId);
  } finally { runB.gate.release.resolve(); }
}

function cellEntries(manager, customType) {
  return manager.getBranch().filter((entry) => entry.customType === customType);
}

async function checkMissingResultAfterReopen(target, manager, removed, survivingId) {
  const original = await readFile(manager.getSessionFile(), "utf8");
  const path = join(target.tempRoot, "settlement-missing-result.jsonl");
  const reopenSource = original.split("\n").flatMap((line) => {
    if (!line) return [line];
    const entry = JSON.parse(line);
    if (entry.id === removed.id) return [];
    // Only direct children need their parent link repaired; retain A's native finished message.
    return [entry.parentId === removed.id ? JSON.stringify({ ...entry, parentId: removed.parentId }) : line];
  }).join("\n");
  await writeFile(path, reopenSource);
  const reopened = SessionManager.open(path);
  assert.equal(reopened.getSessionId(), manager.getSessionId());
  assert.deepEqual(reopened.getBranch().map(({ id }) => id), manager.getBranch().map(({ id }) => id).filter((id) => id !== removed.id));
  const nativeEvents = cellEntries(reopened, "kernel-event");

  const runner = controlledRunner();
  const f = await createYieldedSdkCell({ ...target, runtime: { ...target.runtime, acquire: async () => runner.lease } },
    { ensure: false, sessionManager: reopened });
  const leaf = reopened.getLeafId();
  const ids = [removed.data.cellId, survivingId];
  assert.deepEqual(listCellDeliveries(reopened).map(({ cellId, outcome, delivery }) => [cellId, outcome, delivery]),
    [[ids[0], "unknown", "unknown"], [ids[1], "ok", "delivered"]]);
  assert.equal(readSavedCellResult(reopened, ids[0]), undefined);
  assert.deepEqual(readSavedCellResult(reopened, ids[1]), JSON.parse(JSON.stringify(readSavedCellResult(manager, ids[1]))));
  await f.clock.advance(30_000);
  assert(f.host.isIdle && f.session.isIdle);
  assert.deepEqual(f.kernelWakeIds, []);
  assert.equal(f.provider.state.callCount, 0, "reopen and reconciliation do not wake the model");
  assert.equal(runner.starts, 0, "reopen and reconciliation do not recreate the kernel or replay execution");
  assert.equal(reopened.getLeafId(), leaf, "reconciliation and idle reopen do not append history");
  assert.deepEqual(cellEntries(reopened, "kernel-event"), nativeEvents, "neither native finished message is replayed");
  assert.deepEqual(f.errors, []);
}
