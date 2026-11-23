import assert from "node:assert/strict";
import { test } from "node:test";
import { taskName } from "../../../../shared/background-task-name.js";
import { taskElapsed } from "../../../../web/chat/background-tasks/task-elapsed.js";
import { backgroundTasks } from "../../../../web/chat/background-tasks/background-tasks.js";
import { stopEvidence } from "../../../../web/chat/background-tasks/stop-evidence.js";
import { askStopTarget } from "../../../../web/chat/ask/ask-stop-target.js";

test("task labels prefer a title, otherwise use a bounded first nonempty line", () => {
  assert.equal(taskName({ kind: "kernel", title: " Compile report ", code: "ignored()" }), "Compile report");
  assert.equal(taskName({ kind: "kernel", title: " ", code: "\n  \n  run_job()\nfinish()" }), "run_job()");
  assert.equal(taskName({ kind: "terminal", name: "tests", command: "\n  npm test\nexit" }), "tests · npm test");
  assert.equal(taskName({ kind: "kernel", code: "🐈".repeat(81) }), `${"🐈".repeat(79)}…`);
});

test("terminal time is wall time and kernel time grows from the last active sample only when not waiting", () => {
  const cell = { kind: "kernel", startedAt: 1000, elapsedMs: 3000, activeMs: 1200 };
  assert.equal(taskElapsed(cell, 5000), 2200);
  assert.equal(taskElapsed({ ...cell, waitingForAsk: true }, 8000), 1200);
  assert.equal(taskElapsed(cell, 3900), 1200);
  assert.equal(taskElapsed({ kind: "terminal", startedAt: 2000 }, 5000), 3000);
  assert.equal(taskElapsed({ kind: "terminal", startedAt: 6000 }, 5000), 0);
});

test("the dock orders every cell independently and omits human terminals", () => {
  const cells = [
    { cellId: "cell-b", kernelId: "kernel-b", startedAt: 2000, taskName: "B" },
    { cellId: "cell-a", kernelId: "kernel-a", startedAt: 1000, taskName: "A" },
  ];
  const runningCommand = { id: "command", text: "npm test", startedAt: 1500 };
  const tasks = backgroundTasks(cells, [
    { owner: "human", name: "manual", generation: "pty-1", runningCommand },
    { owner: "model", name: "tests", generation: "pty-2", runningCommand },
  ]);
  assert.deepEqual(tasks.map(({ kernelId, cellId, displayName }) => [kernelId, cellId, displayName]), [
    ["kernel-a", "cell-a", "A"], [undefined, undefined, "tests · npm test"], ["kernel-b", "cell-b", "B"],
  ]);
});

test("a stopping cell reports its latest step and the bounded timer upper bound; running cells report none", () => {
  const timer = { step: "timer", status: "bounded", remainingMs: 8000, evidence: "clock_nanosleep: relative", observedAt: 1 };
  const blockedAt = [{ step: "inject", status: "queued", evidence: "queued", observedAt: 1 }, timer, { step: "child", status: "skipped", evidence: "none", observedAt: 2 }];
  assert.equal(stopEvidence({ status: "running", blockedAt }), null);
  assert.equal(stopEvidence({ status: "stopping" }), null);
  const held = stopEvidence({ status: "stopping", blockedAt });
  assert.equal(held.latest.step, "child");
  assert.equal(held.timerMs, 8000);
  const isolated = { step: "isolated", status: "pending", evidence: "fork", observedAt: 3 };
  // The stopping projection (isolated step first) wins over the raw runner steps.
  assert.deepEqual(stopEvidence({ status: "stopping", blockedAt, stopping: { blockedAt: [isolated] } }), { latest: isolated, steps: [isolated], timerMs: undefined });
});

test("an ask stops only its own yielded cell; a foreground ask names its cell on the turn stop", () => {
  const view = { sessionId: "s", streamId: "x", activeCells: [{ kernelId: "k", cellId: "a" }, { kernelId: "k", cellId: "b" }] };
  const turn = { sessionId: "s", streamId: "x", operationId: "op" };
  assert.deepEqual(askStopTarget({ kernelId: "k", cellId: "b" }, turn, view), { sessionId: "s", streamId: "x", cellOnly: true, cell: { kernelId: "k", cellId: "b" } });
  assert.deepEqual(askStopTarget({ kernelId: "k", cellId: "c" }, turn, view), { ...turn, cell: { kernelId: "k", cellId: "c" } });
  assert.equal(askStopTarget({}, turn, view), turn);
  assert.equal(askStopTarget({ kernelId: "k", cellId: "c" }, null, view), null);
});
