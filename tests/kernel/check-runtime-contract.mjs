import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../../src/kernel/kernel-options.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

await withTargetFixture(async ({ runtime, tempRoot, signal: fixtureSignal, onCleanup }) => {
  // Test the real runner without prelude summaries in exact stdout assertions.
  const hooks = { codeMode: true, prelude: async () => "pass",
    executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, asyncExecution: false }) };
  const python = createPythonTool(runtime, hooks);
  onCleanup(() => python.close());
  const run = (code, signal) => python.tool.execute("smoke", { code }, signal ? AbortSignal.any([signal, fixtureSignal]) : fixtureSignal);
  const text = (result) => result.content.map((part) => part.text ?? "").join("");
  assert.match(text(await run("saved_value = 41\nprint(saved_value)")), /41/);
  assert.match(text(await run("saved_value += 1\nsaved_value")), /42/);
  const failed = await run("raise ValueError('smoke-error')");
  assert.equal(failed.isError, true);
  assert.match(text(failed), /ValueError: smoke-error/);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(run("saved_value = -1", cancelled.signal), { name: "AbortError" });
  assert.match(text(await run("print(saved_value)")), /42/);
  const interrupt = new AbortController();
  const timer = setTimeout(() => interrupt.abort(), 1000);
  try { assert.equal((await run("import time\ntime.sleep(30)", interrupt.signal)).details.outcome, "aborted"); }
  finally { clearTimeout(timer); }
  assert.match(text(await run("print(saved_value)")), /42/);
  const input = await run("input('not allowed')");
  assert.equal(input.isError, true);
  assert.match(text(input), /input\(\) is unsupported/);
  assert.equal((await run("print('x' * 40000)")).details.truncated, true);

  const deadline = createPythonTool({ ...runtime, target: "deadline" }, hooks, { executionTimeoutMs: 100 });
  onCleanup(() => deadline.close());
  await deadline.tool.execute("warm", { code: "deadline_value = 123" });
  assert.equal((await deadline.tool.execute("deadline", { code: "import time\ntime.sleep(10)\ndeadline_value = -1" })).isError, true);
  assert.equal(text(await deadline.tool.execute("recover", { code: "print(deadline_value)" })).trim(), "123");
  await deadline.close();

  const badCwd = createPythonTool({ ...runtime, target: "bad-cwd", cwd: join(tempRoot, "does-not-exist") });
  onCleanup(() => badCwd.close());
  const unexpectedFile = join(tempRoot, "bad-cwd-side-effect.txt");
  await assert.rejects(badCwd.tool.execute("bad", { code: `from pathlib import Path\nPath(${JSON.stringify(unexpectedFile)}).write_text('must not execute')` }));
  await assert.rejects(readFile(unexpectedFile), { code: "ENOENT" });
  await badCwd.close();
  const pid = Number(text(await run("import os\nprint(os.getpid())")).trim());
  assert(Number.isSafeInteger(pid) && pid > 0);
  await python.close();
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" }, "Owned REPL process exits on close");
  console.log("PASS owned runtime: retained state, Python errors, pre-cancel, interrupt/reuse, disabled stdin, bounded output, deadline reuse, bad cwd no-submit and owned cleanup");
});
