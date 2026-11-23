import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";

export async function startWindowRunner(t) {
  const home = await mkdtemp("/tmp/prk-win-");
  const env = { HOME: home, PRK_HOME: join(home, "prk"), TMPDIR: join(home, "tmp") };
  const previous = Object.entries(env).map(([name]) => [name, process.env[name]]);
  t.after(async () => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    await rm(home, { recursive: true, force: true });
  });
  await Promise.all([mkdir(env.PRK_HOME), mkdir(env.TMPDIR)]);
  Object.assign(process.env, env);

  const { DEFAULT_KERNEL_RUNTIME_OPTIONS } = await import("../../../src/kernel/kernel-options.ts");
  const { start } = await import("../../../src/kernel/process/start.ts");
  const { stop } = await import("../../../src/kernel/process/stop.ts");
  const { createCell } = await import("../../../src/kernel/cell/create-cell.ts");
  const peer = controlledRunner();
  const processWindow = { maxRequests: 5, maxBytes: 2 * 1024 * 1024, maxFrameBytes: 1024 * 1024 };
  const ctx = {
    configuration: { target: "owned", cwd: home, python: join(home, "python"), acquire: async () => peer.lease,
      processWindow, scoped: false, memoryMax: "4G", memorySwapMax: "0" },
    hooks: { environment: env }, options: DEFAULT_KERNEL_RUNTIME_OPTIONS,
    snapshot: { state: "not_started", language: "python", activeCells: [] }, listeners: new Set(), closed: false,
    clock: { now: () => performance.now(), schedule(fn, ms) { const timer = setTimeout(fn, ms); return () => clearTimeout(timer); } },
    runnerMaxActiveCells: 4,
    cells: new Map(),
  };
  await start(ctx);
  const kernel = ctx.process;
  return { ctx, kernel, peer, processWindow, registerCell, close: () => stop(ctx, kernel, { cause: "close" }) };

  function registerCell(id, requestId) {
    const cell = createCell(ctx, { timeoutMs: undefined, reminderLadderMs: [] });
    Object.assign(cell, { id, requestId, kernelId: kernel.generation, taskName: "Window test", sdk: { tools: [] } });
    ctx.cells.set(id, cell);
    // This seam sends protocol frames directly, so it owns the release normally done by execute().
    void cell.done.then(() => {
      ctx.cells.delete(id);
      cell.released.resolve();
    });
    return cell;
  }
}

// Only the target connection is controlled; pi-env opens the process and dispatches its stdio.
export function controlledRunner({ confirmCleanup = async () => 0 } = {}) {
  const frames = [];
  let control, generation, starts = 0, writes = 0, interrupts = 0, input = Buffer.alloc(0);
  let cleanups = 0, releases = 0;
  let stderr, exit;
  const emitBatch = (...batch) => control.onEvent({ kind: "output", stream: "stdout" },
    Buffer.from(batch.map((frame) => JSON.stringify({ generation, ...frame }) + "\n").join("")));
  const emit = (frame) => emitBatch(frame);
  const admit = ({ cellId, id, generation }, mode = "thread") => emit({ kind: "cell_admitted", generation, cellId, re: id, mode });
  const connection = {
    async info() { return { features: ["process"] }; },
    async request(op, params, options) {
      if (op === "process") {
        starts++;
        control = options;
        generation = undefined;
        input = Buffer.alloc(0);
        stderr = (bytes) => options.onEvent({ kind: "output", stream: "stderr" }, Buffer.from(bytes));
        const exited = Promise.withResolvers();
        const finish = (exitCode) => exited.resolve({ json: { exitCode } });
        exit = finish;
        options.signal.addEventListener("abort", () => finish(0), { once: true });
        await setImmediate();
        options.onStart(1, "owned");
        options.onEvent({ kind: "started", pid: 42 });
        return exited.promise;
      }
      if (op === "exec") {
        if (params.argv[0] === "/bin/kill") {
          assert.deepEqual(params.argv, ["/bin/kill", "-INT", "--", "-42"]);
          interrupts++;
        } else {
          assert(control.signal.aborted, "cleanup must first close the controlled process handle");
          cleanups++;
          return { json: { exitCode: await confirmCleanup() } };
        }
        return { json: { exitCode: 0 } };
      }
      assert.equal(op, "processWrite");
      assert.equal(params.target, 1);
      assert.equal(options.session, "owned");
      writes++;
      input = Buffer.concat([input, options.payload]);
      let end;
      while ((end = input.indexOf(10)) >= 0) {
        const frame = JSON.parse(input.subarray(0, end).toString("utf8"));
        const bytes = end + 1; // Actual processWrite bytes, including the JSONL delimiter.
        input = input.subarray(bytes);
        if (generation === undefined) {
          generation = frame.configuration.generation;
          await setImmediate();
          emit({ kind: "ready", cellId: null, pid: 42, pgid: 42, scoped: false, language: "python", version: "3.12.0" });
        } else frames.push({ frame, bytes });
      }
      return { json: {} };
    },
  };
  const lease = { connection, generation: "owned", signal: new AbortController().signal, async release() { releases++; } };
  return { lease, frames, emit, emitBatch, admit, get stderr() { return stderr; }, get exit() { return exit; },
    get cleanups() { return cleanups; }, get releases() { return releases; },
    get starts() { return starts; }, get writes() { return writes; }, get interrupts() { return interrupts; } };
}
