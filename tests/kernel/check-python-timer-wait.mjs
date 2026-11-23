import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../../src/kernel/kernel-options.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { activeClock, text, until } from "./fixtures/create-yielded-sdk-cell.mjs";

await withTargetFixture(async ({ runtime, tempRoot, onCleanup }) => {
  const controlled = activeClock();
  let clockStall = 0;
  const clock = { ...controlled, now: () => controlled.now() + clockStall };
  const grace = 40;
  let maxTimerWaitMs = 1200;
  const kernel = createPythonTool({ ...runtime, scoped: false }, {
    clock, codeMode: true, prelude: async () => "pass",
    executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, maxActiveCells: 2,
      interruptTimeoutMs: grace, maxTimerWaitMs }),
  });
  onCleanup(() => kernel.close());
  const results = new Map();
  kernel.subscribeFinished(({ cellId, result, release }) => { results.set(cellId, result); release(); });
  const finished = (id) => until(() => results.get(id), `terminal result for ${id}`);
  const foreground = (code) => kernel.executeForeground("inspect", { code });
  const start = async (title, body) => {
    const run = await kernel.tool.execute(title, { code: `import time\nprint(${JSON.stringify(title)})\n${body}`, title, yield_s: 0 });
    const id = JSON.parse(text(run)).cell_id;
    await until(() => kernel.previewCell(id)?.output.includes(title), `${title} entered`);
    await delay(30); // The marker precedes the native call; let Python enter it before cancelling.
    return id;
  };
  const observed = (id) => until(() => kernel.previewCell(id)?.blockedAt, "runner stop evidence");
  const timerStep = (steps) => steps.find(({ step, status }) => step === "timer" && status === "bounded");
  const bound = async (id) => {
    const steps = await observed(id);
    const timer = timerStep(steps);
    assert(timer, `valid sleep has no bounded timer evidence: ${JSON.stringify(steps)}`);
    return timer;
  };
  const version = text(await foreground("import sys\nsaved_timer_value = 42\nprint(sys.version.split()[0])")).trim();
  assert.match(version, /^3\.(9|12)\./, "run this ABI regression under CPython 3.9 and 3.12");
  const generation = kernel.getSnapshot().kernelId;

  const release = join(tempRoot, "release-peer");
  const peer = await start("peer-entered", `import os\nwhile not os.path.exists(${JSON.stringify(release)}):\n    time.sleep(0.01)\nprint('PEER_OK')`);
  const sleeper = await start("sleeper-entered", "time.sleep(1.2)\nraise AssertionError('stop must arrive before this line')");
  await delay(220); // Both let the runner enter the syscall and distinguish elapsed vs full duration.
  assert.equal((await kernel.requestCellInterrupt(sleeper, "auto")).grace_ms, grace);
  const evidence = await bound(sleeper);
  if (version.startsWith("3.9.")) {
    assert.match(evidence.evidence, /^pselect6: relative timeout upper bound$/);
    assert.equal(evidence.remainingMs, 1200);
  } else {
    assert.match(evidence.evidence, /^clock_nanosleep: CLOCK_MONOTONIC absolute deadline$/);
    assert(evidence.remainingMs > grace && evidence.remainingMs <= 1000, JSON.stringify(evidence));
  }
  await clock.advance(grace);
  assert.equal(kernel.previewCell(peer)?.status, "running", "original N must not retire the peer");
  assert.equal(kernel.previewCell(sleeper)?.status, "stopping");
  const aborted = await finished(sleeper);
  assert.equal(aborted.details.outcome, "aborted");
  assert.equal(aborted.details.cause, undefined, "confirmed cell_end, not generation retirement");
  await clock.advance(evidence.remainingMs);
  assert.equal(kernel.getSnapshot().kernelId, generation);
  await writeFile(release, "");
  assert.match(text(await finished(peer)), /PEER_OK/);
  assert.equal(text(await foreground("print(saved_timer_value)")).trim(), "42");
  console.log(`PASS ${version}: ${evidence.evidence}, ${evidence.remainingMs} ms; original N preserves the peer and namespace`);

  const swallowed = await start("swallow-entered", "try:\n    time.sleep(0.7)\nexcept KeyboardInterrupt:\n    print('SECOND_SLEEP')\n    time.sleep(30)");
  const requestedAt = clock.now();
  await kernel.requestCellInterrupt(swallowed, "auto");
  const first = await bound(swallowed);
  assert(first.remainingMs > grace);
  await clock.advance(grace);
  await until(() => kernel.previewCell(swallowed)?.output.includes("SECOND_SLEEP"), "exception was swallowed and a second sleep began");
  const repeated = await kernel.requestCellInterrupt(swallowed, "auto");
  assert.equal(clock.now() + repeated.grace_ms, requestedAt + first.remainingMs, "second sleep and repeat must not renew the deadline");
  await clock.advance(repeated.grace_ms - 1);
  assert.equal(kernel.previewCell(swallowed).status, "stopping");
  await clock.advance(1);
  assert.equal((await finished(swallowed)).details.cause, "interrupt-timeout", "no extra N at the timer cutoff");
  assert.equal(kernel.getSnapshot().state, "unavailable", "retirement must not start a new generation");
  assert.equal(kernel.getSnapshot().kernelId, generation);

  for (const limit of [1, 0]) {
    maxTimerWaitMs = limit;
    const id = await start(`cap-${limit}-entered`, "import select\nselect.poll().poll(4000)");
    await kernel.requestCellInterrupt(id, "auto");
    const poll = await bound(id);
    assert.match(poll.evidence, /^poll: relative timeout upper bound$/);
    assert.equal(poll.remainingMs, 4000);
    await clock.advance(grace);
    assert.equal((await finished(id)).details.cause, "interrupt-timeout");
  }
  maxTimerWaitMs = DEFAULT_KERNEL_EXECUTION_POLICY.maxTimerWaitMs;
  for (const [title, body] of [
    ["infinite", "import select\nselect.poll().poll()"],
    ["with-fd", "import os, select\nr, w = os.pipe()\nselect.select([r], [], [], 4)"],
  ]) {
    const id = await start(`${title}-entered`, body);
    await kernel.requestCellInterrupt(id, "auto");
    assert.equal(timerStep(await observed(id)), undefined, `${title} is not a finite zero-fd timer`);
    await clock.advance(grace);
    assert.equal((await finished(id)).details.cause, "interrupt-timeout");
  }

  const never = await start("never-entered", "time.sleep(30)");
  const neverReply = kernel.requestCellInterrupt(never, "never");
  await bound(never);
  await clock.advance(grace);
  assert.equal((await neverReply).status, "stopping", "never returns at the original N");
  const waiting = await start("now-entered", "time.sleep(30)");
  await kernel.requestCellInterrupt(waiting, "auto");
  const pending = await bound(waiting);
  await clock.advance(grace);
  assert.equal((await kernel.requestCellInterrupt(waiting, "auto")).grace_ms, pending.remainingMs - grace);
  await assert.rejects(kernel.tool.execute("full", { code: "raise AssertionError('not admitted')" }), { code: "BUSY", transient: true });
  const now = await kernel.requestCellInterrupt(waiting, "now");
  assert.equal(now.status, "retired");
  assert.equal(now.cause, "interrupt-now");
  assert.deepEqual(new Set(now.affectedCells.map(({ cellId }) => cellId)), new Set([never, waiting]));
  assert.equal((await finished(never)).details.cause, "interrupt-now");
  // The clock can pass N while the Gateway has not yet dispatched the scheduled callback.
  const late = await start("late-evidence", "time.sleep(2)");
  const lateReply = kernel.requestCellInterrupt(late, "auto");
  clockStall = grace;
  assert.equal((await lateReply).grace_ms, grace);
  await bound(late);
  assert.equal((await kernel.requestCellInterrupt(late, "auto")).grace_ms, 0, "late evidence must not renew the deadline");
  await clock.advance(grace);
  assert.equal((await finished(late)).details.cause, "interrupt-timeout");
  console.log("PASS single cutoff: swallowed exception, late/over-cap/disabled, unbounded or fd wait, never slot and now override");
});
