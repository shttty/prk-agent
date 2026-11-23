import assert from "node:assert/strict";
import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { setImmediate, setTimeout } from "node:timers/promises";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../../src/kernel/kernel-options.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../src/config/terminal/terminal-options.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { checkActiveCellAdmission, checkRunnerBusy } from "./fixtures/check-active-cell-admission.mjs";
import { checkCellClockIsolation } from "./fixtures/check-cell-clock-isolation.mjs";

function fakeClock() {
  let now = 0;
  const timers = new Map();
  return {
    now: () => now,
    schedule(fn, delay) {
      const timer = { fn, due: now + delay };
      timers.set(timer, timer);
      return () => { timers.delete(timer); };
    },
    async advance(ms) {
      now += ms;
      for (;;) {
        const timer = [...timers.values()].filter(({ due }) => due <= now).sort((a, b) => a.due - b.due)[0];
        if (!timer) break;
        timers.delete(timer);
        timer.fn();
        await setImmediate();
      }
    },
    delays: () => [...timers.values()].map(({ due }) => due - now),
  };
}

async function until(check, label) {
  const deadline = performance.now() + 5_000;
  while (!await check()) {
    if (performance.now() >= deadline) assert.fail(label);
    await setTimeout(10);
  }
}

await checkActiveCellAdmission(until);
await checkRunnerBusy(until);
await checkCellClockIsolation(fakeClock, until);

await withTargetFixture(async ({ runtime, tempRoot, onCleanup }) => {
  const clock = fakeClock();
  const options = { ...DEFAULT_KERNEL_EXECUTION_POLICY, asyncExecution: false };
  const owner = createPythonTool({ ...runtime, scoped: false }, {
    codeMode: true, clock, executionPolicy: () => options,
    outputOptions: { ...DEFAULT_TERMINAL_OPTIONS, yieldMs: 60_000 },
  }, { executionTimeoutMs: 0 });
  onCleanup(() => owner.close());
  const call = (id, code, args = {}, sdk) => owner.tool.execute(id, { code, ...args }, undefined, undefined, sdk);
  const text = (reply) => reply.content[0].text;
  const reminders = [];
  let foregroundReturned = false;
  const unsubscribe = owner.subscribeReminders((reminder) => reminders.push({ ...reminder, foregroundReturned }));
  onCleanup(unsubscribe);

  await owner.ensure();
  const kernelId = owner.getSnapshot().kernelId;
  const quick = 'print("\\x1b[31mready\\x1b[0m")';
  const oldShape = await call("sync-quick", quick);
  assert.equal(text(oldShape), "ready\n");
  assert.equal(oldShape.details.rawOutput, "\x1b[31mready\x1b[0m\n");
  assert.equal(oldShape.details.outcome, "ok");
  assert.equal(oldShape.details.kernelId, kernelId);
  options.asyncExecution = true;
  assert.deepEqual(await call("async-quick", quick), oldShape);
  assert.deepEqual(clock.delays(), [], "cell_end clears both timing paths");

  const marker = join(tempRoot, "printing");
  const stop = join(tempRoot, "stop");
  // Keep writing real style-bearing stdout while the Gateway's active clock advances independently.
  const slow = call("slow", `import os, time\nprint('\\x1b[32mfirst line\\x1b[0m', flush=True)\ntime.sleep(0.05)\nopen(${JSON.stringify(marker)}, 'w').close()\nwhile not os.path.exists(${JSON.stringify(stop)}):\n print('still running', flush=True)\n time.sleep(0.01)\nkept_after_yield = 42`);
  let running;
  const observed = slow.then((value) => { running = value; foregroundReturned = true; });
  try {
    await until(() => access(marker).then(() => true, () => false), "real cell never began printing");
    await clock.advance(59_999);
    assert.equal(running, undefined);
    await clock.advance(1);
    assert(running, "async execute must return running at the default terminal yield");
    const body = JSON.parse(text(running));
    assert.deepEqual(Object.keys(body).sort(), ["cell_id", "image_count", "note", "output", "status", "truncated"]);
    assert.equal(body.status, "running");
    assert.match(body.output, /first line/);
    assert(!body.output.includes("\x1b"));
    assert(!body.output.includes("Kernel variables"));
    assert.equal(body.image_count, 0);
    assert.equal(body.truncated, false);
    assert.deepEqual(running.details, { toolCallId: "slow", kernelId, startedAt: running.details.startedAt });
    assert(Number.isSafeInteger(running.details.startedAt));
    assert.equal(owner.getSnapshot().state, "busy");
    await assert.rejects(call("busy", "legacy_busy_ran = True"), { code: "BUSY", transient: true });
    assert.deepEqual(reminders.map(({ dueMs }) => dueMs), [60_000]);

    // A live switch must not affect this cell. Arrive late at step 2, then jump past the rest.
    options.asyncExecution = false;
    await clock.advance(240_123);
    assert.deepEqual(clock.delays(), [599_877], "late callback must not slide step 3");
    await clock.advance(5_099_877);
    assert.deepEqual(reminders.map(({ dueMs }) => dueMs), [60_000, 300_000, 900_000, 1_800_000, 3_600_000, 5_400_000]);
    assert.deepEqual(reminders.map(({ step }) => step), [1, 2, 3, 4, 5, 6]);
    assert(reminders.every((r) => r.cellId === body.cell_id && r.kernelId === kernelId && r.foregroundReturned));
    assert.equal(owner.getSnapshot().state, "busy", "async zero has no hard limit");
  } finally {
    await writeFile(stop, "");
    await observed;
  }
  await until(() => owner.getSnapshot().state === "idle", "yielded cell did not end");
  const retained = await call("read-retained", "assert 'legacy_busy_ran' not in globals()\nprint(kept_after_yield)");
  assert.equal(text(retained), "42\n");
  assert.equal(retained.details.kernelId, kernelId, "legacy BUSY does not retire the live REPL");

  const askEntered = Promise.withResolvers();
  const answer = Promise.withResolvers();
  const sdk = { executeTool: async (name) => {
    assert.equal(name, "ask");
    askEntered.resolve();
    await answer.promise;
    return { isError: false, result: { content: [{ type: "text", text: "answer" }] } };
  } };
  options.asyncExecution = true;
  const askCell = call("ask", "gateway.ask()", { yield_s: 0.01 }, sdk);
  await Promise.race([askEntered.promise, askCell.then(() => assert.fail("ask did not start"))]);
  await clock.advance(1_800_000);
  assert.equal(JSON.parse(text(await askCell)).status, "running", "ask does not pause foreground yield");
  assert.equal(reminders.length, 6, "ask pauses active reminders");
  answer.resolve();
  await until(() => owner.getSnapshot().state === "idle", "ask reply did not reach the cell");
  assert.deepEqual(clock.delays(), [], "ask completion cancels the resumed active timer");

  options.asyncExecution = false;
  let synchronous;
  const entered = join(tempRoot, "sync-started");
  const waiting = call("sync", `open(${JSON.stringify(entered)}, 'w').close()\nwhile True:\n time.sleep(0.01)`, { yield_s: 0 })
    .then((value) => { synchronous = value; });
  await until(() => access(entered).then(() => true, () => false), "sync cell never started");
  options.asyncExecution = true;
  await clock.advance(299_999);
  assert.equal(synchronous, undefined, "sync ignores yield_s:0 and mode changes in flight");
  assert.equal(reminders.length, 6, "no reminders for synchronous cells");
  await clock.advance(1);
  await waiting;
  assert.equal(synchronous.details.outcome, "aborted");
  assert.equal(synchronous.isError, true);
  assert.match(text(synchronous), /Kernel timed out after 300000ms/);
  assert.equal(owner.getSnapshot().kernelId, kernelId, "timeout retains the same REPL");
  assert.deepEqual(clock.delays(), []);
  console.log("PASS real REPL wait policy: fast result, retained owner, active ladder, ask pause, sync deadline");
});
