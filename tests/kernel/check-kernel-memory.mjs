import { checkGatewayMemory } from "./kernel-memory/check-gateway-memory.mjs";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parseKernelOptions } from "../../src/config/kernel/parse-kernel-options.ts";

const home = await mkdtemp(join(tmpdir(), "prk-memory-check-"));
initializePrkHome(home);
const { createPythonTool } = await import("../../src/kernel/assemble-kernel.ts");
const { kernelPrelude } = await import("../../src/codemode/kernel-prelude/build-prelude.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { validateRequest } = await import("../../src/gateway/wire/validate-request.ts");
const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
const options = parseKernelOptions({ memoryMax: "512M", telemetryIntervalMs: 50 });
try {
  for (const invalid of [{ memoryMax: "max" }, { memoryMax: "0" }, { memorySwapMax: "-1" }, { telemetryIntervalMs: 0 }, { telemetryIntervalMs: 1.5 }, { unexpected: true }]) {
    assert.throws(() => parseKernelOptions(invalid));
  }
  const targets = [{ id: "one", label: "One", local: true, python: process.env.PI_TEST_PYTHON, cwd: "/srv/one", kernel: { memoryMax: "512M" } }, { id: "two", label: "Two", local: true, python: process.env.PI_TEST_PYTHON, cwd: "/srv/two" }];
  const configured = parsePrkConfig({ kernel: { memoryMax: "1G", memorySwapMax: "64M", telemetryIntervalMs: 50 } }, { instances: targets });
  assert.equal(configured.instances[0].kernel.kernelOptions.memoryMax, "512M");
  assert.equal(configured.instances[1].kernel.kernelOptions.memoryMax, "1G");
  assert.equal(configured.instances[0].kernel.kernelOptions.memorySwapMax, "64M");
  for (const method of ["kernelClear", "kernelRestart"]) {
    assert.equal(validateRequest({ v: 1, id: 1, method, params: { sessionId: "one" } }).method, method);
    assert.throws(() => validateRequest({ v: 1, id: 1, method, params: { sessionId: "one", extra: true } }));
  }
  await withTargetFixture(async ({ config, runtime, tempRoot, onCleanup }) => {
    const samples = [];
    const live = Promise.withResolvers();
    const owner = createPythonTool({ ...runtime, memoryMax: options.memoryMax, memorySwapMax: options.memorySwapMax }, { codeMode: true,
      prelude: () => kernelPrelude({ kernel: options }),
      onTelemetry: (event) => {
        if (event.kind !== "memory") return;
        samples.push(event.value);
        if (owner.getSnapshot().state === "busy" && event.value.extra > 24 * 1024 ** 2) live.resolve(event.value);
      },
    });
    onCleanup(() => owner.close());
    const execute = async (code) => {
      const result = await owner.tool.execute("memory-cell", { code, title: "Memory check" });
      assert.notEqual(result.isError, true, text(result));
      return text(result);
    };
    await owner.ensure();
    const initial = owner.getSnapshot();
    assert.equal(initial.state, "idle");
    assert(initial.memory, "Prelude must publish initial scope memory");
    assert.equal(initial.memory.memoryMax, "512M");
    assert.equal(initial.memory.memorySwapMax, "0");
    const originalPid = Number((await execute("import os\nprint('PID:' + str(os.getpid()))")).match(/PID:(\d+)/u)[1]);
    const running = execute(`import subprocess, sys, time
kept = bytearray(16 * 1024 ** 2)
child = subprocess.Popen([sys.executable, '-c', "import time; x=bytearray(32*1024**2); print('ready', flush=True); time.sleep(10)"], stdout=subprocess.PIPE, text=True)
try:
    assert child.stdout.readline().strip() == 'ready'
    from pathlib import Path
    assert Path('/proc/self/cgroup').read_text() == Path('/proc/' + str(child.pid) + '/cgroup').read_text()
    until = time.monotonic() + 2
    while time.monotonic() < until:
        pass
finally:
    child.terminate()
    child.wait()
print('subprocess scope included')`);
    const timer = setTimeout(() => live.reject(new Error("No live busy-cell cgroup telemetry")), 5000);
    try {
      const measured = await live.promise;
      assert.equal(measured.scope, initial.memory.scope);
      assert.equal(measured.extra, measured.current - measured.baseline);
      assert.match(await running, /subprocess scope included/);
    } finally { clearTimeout(timer); }
    const cleared = await owner.clear();
    assert.equal(cleared.kernelId, initial.kernelId);
    assert.equal(cleared.memory.scope, initial.memory.scope);
    assert.equal(cleared.memory.baseline, initial.memory.baseline);
    await execute(`import os, threading
assert os.getpid() == ${originalPid}
assert 'kept' not in globals()
assert callable(gateway.call)
assert sum(t.name == 'prk-memory' for t in threading.enumerate()) == 1
restart_marker = 42`);
    const restarted = await owner.restart();
    assert.equal(restarted.state, "idle");
    assert.notEqual(restarted.kernelId, initial.kernelId);
    assert.notEqual(restarted.memory.scope, initial.memory.scope);
    assert.equal(restarted.memory.extra, restarted.memory.current - restarted.memory.baseline);
    await execute(`import os, threading
assert os.getpid() != ${originalPid}
assert 'restart_marker' not in globals()
assert callable(gateway.call)
assert sum(t.name == 'prk-memory' for t in threading.enumerate()) == 1`);
    const unscoped = createPythonTool({ ...runtime, scoped: false }, { codeMode: true,
      prelude: () => kernelPrelude({ kernel: { ...options, scoped: false } }) });
    onCleanup(() => unscoped.close());
    const unscopedResult = await unscoped.tool.execute("unscoped", { code: "print('unscoped ok')" });
    assert.equal(Boolean(unscopedResult.isError), false, text(unscopedResult));
    assert.match(text(unscopedResult), /unscoped ok/);
    assert.equal(unscoped.getSnapshot().memory, undefined);
    await checkGatewayMemory({ config, tempRoot, home, options, onCleanup, text });
    assert(samples.length > 2);
    console.log("PASS scoped memory: limits, live busy telemetry/subprocess, same-REPL clear, new-REPL restart baseline, unscoped memory absence and actual Gateway wire actions/rejections");
  });
} finally { await rm(home, { recursive: true, force: true }); }
