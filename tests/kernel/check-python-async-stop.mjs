import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { ownedProc, readProc } from "./fixtures/open-isolated-stop-witness.mjs";

if (process.platform !== "linux" || process.arch !== "x64") {
  console.log("SKIP: async stop ladder requires Linux x86_64 native wait observation");
  process.exit(0);
}

await withTargetFixture(async ({ runtime, tempRoot, onCleanup }) => {
  const prk = join(tempRoot, "prk"), agent = join(prk, "agent");
  const environment = { HOME: tempRoot, PRK_HOME: prk, TMPDIR: tempRoot, XDG_RUNTIME_DIR: tempRoot,
    XDG_CONFIG_HOME: join(tempRoot, "config"), XDG_CACHE_HOME: join(tempRoot, "cache"), XDG_STATE_HOME: join(tempRoot, "state"),
    PI_CODING_AGENT_DIR: agent, PRK_CODING_AGENT_DIR: agent };
  Object.assign(process.env, environment);
  const { createPythonTool } = await import("../../src/kernel/assemble-kernel.ts");
  const { DEFAULT_KERNEL_EXECUTION_POLICY } = await import("../../src/kernel/kernel-options.ts");
  const { text, until, within } = await import("./fixtures/create-yielded-sdk-cell.mjs");
  const owner = createPythonTool({ ...runtime, scoped: false }, { codeMode: true, environment });
  const results = new Map(), evidence = new Map();
  const unsubscribeFinished = owner.subscribeFinished(({ cellId, result, release }) => {
    results.set(cellId, result);
    release();
  });
  const unsubscribe = owner.subscribe(({ activeCells }) => {
    for (const { cellId, blockedAt } of activeCells) if (blockedAt?.length) evidence.set(cellId, blockedAt);
  });
  const mark = (name) => writeFile(join(tempRoot, name), "");
  const marked = (name) => until(() => existsSync(join(tempRoot, name)), `${name} in the owned wait fixture`);
  onCleanup(async () => {
    try { await mark("release-all"); }
    finally {
      try { await within(owner.close(), "close owned async-stop kernel"); }
      finally { unsubscribe(); unsubscribeFinished(); }
    }
  });

  const fixture = await readFile(new URL("./fixtures/async-stop-waits.py", import.meta.url), "utf8");
  const setup = await within(owner.executeForeground("install owned witnesses", { mode: "thread",
    code: `${fixture}\nprint('ASYNC_STOP_PYTHON', sys.implementation.name, sys.version.split()[0])`,
  }), "load the wait fixture as ordinary Python code");
  assert.equal(setup.details.outcome, "ok", text(setup));
  const version = text(setup).match(/ASYNC_STOP_PYTHON cpython (\d+\.\d+\.\S+)/)?.[1];
  assert(version, text(setup));
  const generation = setup.details.kernelId;
  assert(generation);

  const output = (id) => owner.previewCell(id)?.output ?? "";
  const printed = (id, line) => until(() => output(id).includes(line), `${id} printed ${line}`);
  const start = async (title, code) => {
    const result = await within(owner.tool.execute(title, { title, mode: "async", yield_s: 0, code }), `yield ${title}`);
    assert.equal(Boolean(result.isError), false, text(result));
    const { status, cell_id: id } = JSON.parse(text(result));
    assert.equal(status, "running");
    assert(id);
    assert.equal(result.details.kernelId, generation);
    assert.equal(owner.previewCell(id)?.mode, "async");
    return id;
  };
  const stop = async (id) => {
    const result = await within(owner.requestCellInterrupt(id, "auto"), `stop ${id}`);
    assert.equal(result.status, "requested");
    assert.equal(result.cell_id, id);
    return result;
  };
  const finished = async (id, outcome, ...lines) => {
    const result = await until(() => results.get(id), `terminal result of ${id}`);
    assert.equal(result.details.outcome, outcome, text(result));
    assert.equal(result.details.mode, "async");
    assert.equal(result.details.kernelId, generation);
    assert.equal(result.details.cause, undefined, "targeted stop must not retire the generation");
    for (const line of lines) assert(text(result).includes(line), text(result));
    return result;
  };
  const cancelledA = (id) => finished(id, "aborted", "A_CANCELLED", "A_FINALLY_ENTER", "A_FINALLY_EXIT");
  const stoppedAt = (id) => until(() => evidence.get(id), `runner stop evidence for ${id}`);
  const assertTaskOnly = (steps) => {
    assert(steps.some(({ step, status }) => step === "task" && status === "queued"), JSON.stringify(steps));
    for (const entry of steps) {
      const { step, status, action } = entry;
      assert.equal(action, undefined, JSON.stringify(entry));
      assert.notEqual(status, "applied", JSON.stringify(entry));
      assert(step !== "timer" || status !== "bounded", JSON.stringify(entry));
      assert(step !== "inject" || ["skipped", "unavailable"].includes(status), JSON.stringify(entry));
    }
  };
  const assertLadderAction = async (id, step) => {
    const steps = await stoppedAt(id);
    assert(steps.some((entry) => entry.step === step && entry.status === "applied" && entry.action), JSON.stringify(steps));
  };

  const firstA = await start("A freely awaiting", `saved_loop = asyncio.get_running_loop()
free_a = AsyncStopTrial(saved_loop)
await free_a.run_a('finally.release')`);
  await printed(firstA, "A_WAITING");
  await stop(firstA);
  await printed(firstA, "A_FINALLY_ENTER");
  assertTaskOnly(await stoppedAt(firstA));
  assert.equal(owner.previewCell(firstA)?.status, "stopping");
  assert(!results.has(firstA) && !output(firstA).includes("A_FINALLY_EXIT"), "A must keep its slot while its finally awaits");
  await mark("finally.release");
  await cancelledA(firstA);
  console.log(`PASS CPython ${version}: await receives CancelledError in A's root; terminal waits for its asynchronous finally`);

  const a = await start("A suspended behind B", `assert free_a.a.done()
blocked = AsyncStopTrial(saved_loop)
await blocked.run_a()`);
  await printed(a, "A_WAITING");
  const c = await start("C waiting to resume behind B", "await blocked.run_c()");
  await printed(c, "C_WAITING");
  const b = await start("B blocked in socketpair recv", "blocked.run_b()");
  await marked("b.ready");
  await stop(a);
  assertTaskOnly(await stoppedAt(a));
  const read = await within(owner.readCell(a), "read the stopping projection for A");
  assert.equal(read.details.stopping.cell_id, a);
  const pair = read.details.stopping.blockedAt.find(({ step, status }) => step === "task" && status === "queued");
  assert.deepEqual([pair?.targetCellId, pair?.blockingCellId], [a, b], JSON.stringify(read.details.stopping));
  await mark("b.check");
  await marked("b.intact");
  assert.equal(owner.previewCell(b)?.status, "running");
  assert.equal(owner.previewCell(b)?.blockedAt, undefined, "stopping A must not start B's stop ladder");
  assert.equal(owner.previewCell(c)?.status, "running");
  assert(!results.has(a) && !results.has(b) && !results.has(c), "all three roots remain live behind B's recv");
  assert(!output(c).includes("C_RESUMED"), "B made C runnable but did not yield the loop");
  await stop(b);
  await assertLadderAction(b, "socket");
  await finished(b, "aborted", "B_FINALLY");
  await cancelledA(a);
  await finished(c, "ok", "C_RESUMED", "C_OK_AFTER_B_TASK_DONE");
  assert.equal(owner.getSnapshot().kernelId, generation);
  console.log(`PASS CPython ${version}: stop A reports A=${a}, blocker B=${b} without acting; explicit B stop shuts down recv, A cancels, and pending C runs in ${generation}`);

  const unowned = await start("A behind an ordinary loop callback", `unowned = AsyncStopTrial(saved_loop)
await unowned.run_a(callback=unowned.callback)`);
  await marked("callback.ready");
  await stop(unowned);
  const unknown = await stoppedAt(unowned);
  assertTaskOnly(unknown);
  assert(unknown.every((entry) => !("targetCellId" in entry) && !("blockingCellId" in entry)), JSON.stringify(unknown));
  assert(!results.has(unowned), "an ordinary blocked callback prevents the queued cancel from running");
  await mark("callback.release");
  await marked("callback.returned");
  await cancelledA(unowned);
  console.log(`PASS CPython ${version}: blocked loop callback has no root ownership; fixture release is required before A can cancel`);

  if (Number(version.split(".")[1]) >= 12) {
    const eager = await start("B whose eager child owns the thread", "await unowned.eager_parent()");
    await marked("eager.ready");
    await stop(eager);
    const steps = await stoppedAt(eager);
    assertTaskOnly(steps);
    assert(steps.every((entry) => !("blockingCellId" in entry)), JSON.stringify(steps));
    await mark("eager.check");
    await marked("eager.intact");
    assert(!results.has(eager), "nested eager Task must stay in recv until released");
    await mark("eager.release");
    await finished(eager, "aborted", "EAGER_CHILD_RETURNED", "EAGER_ROOT_CANCELLED", "EAGER_ROOT_FINALLY_EXIT");
    const next = await owner.executeForeground("C after eager child", { mode: "async",
      code: "assert asyncio.get_running_loop() is saved_loop and unowned.eager_task.result() == 42" });
    assert.equal(next.details.outcome, "ok", text(next));
    assert.equal(next.details.kernelId, generation);
    console.log(`PASS CPython ${version}: eager Task received no interruption or socket shutdown; B cancelled after yield and C then ran`);
  }

  const cpu = await start("Owned Python CPU segment", `try:
 unowned.cpu()
finally:
 await asyncio.sleep(0)
 print('CPU_ASYNC_FINALLY_EXIT')`);
  await printed(cpu, "CPU_RUNNING");
  await stop(cpu);
  await finished(cpu, "aborted", "CPU_FINALLY", "CPU_ASYNC_FINALLY_EXIT");
  console.log(`PASS CPython ${version}: running Python segment unwound inside its own root Task`);

  const childWait = await start("Ordinary subprocess wait", "unowned.wait_child()");
  await marked("child.ready");
  const [pid, runnerPid] = await until(() => output(childWait).match(/CHILD_PID=(\d+) RUNNER_PID=(\d+)/)?.slice(1).map(Number), "owned child PID");
  const child = readProc(pid), runner = readProc(runnerPid);
  assert(child && runner && child.parent === runnerPid && child.group === runner.group && child.state !== "Z",
    "the wait target must be a live ordinary child of this runner in the runner's group");
  await stop(childWait);
  await assertLadderAction(childWait, "child");
  await finished(childWait, "aborted", "CHILD_FINALLY");
  assert.equal(ownedProc(child), undefined, "terminal result requires the child to be reaped, not just signalled");
  assert(ownedProc(runner), "stop must not signal the runner's process group");
  assert.equal(owner.getSnapshot().kernelId, generation);
  assert.equal(owner.getSnapshot().connectionStatus, "connected");
  console.log(`PASS CPython ${version}: stop during native wait reaps ordinary child ${pid}, leaving the same runner connected`);

  const timerSeconds = DEFAULT_KERNEL_EXECUTION_POLICY.interruptTimeoutMs / 1000 + 4;
  const timer = await start("Owned zero-fd timer", `unowned.wait_timer(${timerSeconds})`);
  await marked("timer.ready");
  // A relative sample bounds the full wait. Leave room between natural wakeup and the observed upper bound.
  await delay(300);
  const original = await stop(timer);
  const steps = await stoppedAt(timer);
  const bound = steps.find(({ step, status }) => step === "timer" && status === "bounded");
  assert(bound?.remainingMs > original.grace_ms, JSON.stringify(steps));
  const extended = await stop(timer);
  assert(extended.grace_ms > original.grace_ms && extended.grace_ms <= bound.remainingMs,
    `original=${original.grace_ms}, extended=${extended.grace_ms}, bound=${bound.remainingMs}`);
  await delay(original.grace_ms);
  await finished(timer, "aborted", "TIMER_FINALLY");
  assert.equal(owner.getSnapshot().kernelId, generation);
  assert.equal(owner.getSnapshot().connectionStatus, "connected");
  console.log(`PASS CPython ${version}: verified zero-fd timer extended only its own ${original.grace_ms} ms grace to ${extended.grace_ms} ms and kept the generation`);
}, { tempParent: "/tmp" });
