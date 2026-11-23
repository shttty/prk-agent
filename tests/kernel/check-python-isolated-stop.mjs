import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { openIsolatedStopWitness, ownedProc, readProc, withFrozenRunner } from "./fixtures/open-isolated-stop-witness.mjs";

if (process.platform !== "linux") {
  console.log("SKIP: isolated stop evidence requires Linux /proc");
  process.exit(0);
}

await withTargetFixture(async (target) => {
  const { runtime, tempRoot, onCleanup } = target;
  const prk = join(tempRoot, "prk"), agent = join(prk, "agent");
  const environment = { HOME: tempRoot, PRK_HOME: prk, TMPDIR: tempRoot, XDG_RUNTIME_DIR: tempRoot,
    XDG_CONFIG_HOME: join(tempRoot, "config"), XDG_CACHE_HOME: join(tempRoot, "cache"), XDG_STATE_HOME: join(tempRoot, "state"),
    PI_CODING_AGENT_DIR: agent, PRK_CODING_AGENT_DIR: agent };
  Object.assign(process.env, environment);
  const { createPythonTool } = await import("../../src/kernel/assemble-kernel.ts");
  const { DEFAULT_KERNEL_EXECUTION_POLICY } = await import("../../src/kernel/kernel-options.ts");
  const { text, until, within } = await import("./fixtures/create-yielded-sdk-cell.mjs");
  const witness = await openIsolatedStopWitness(target, until);
  const graceMs = 1000;
  const owner = createPythonTool({ ...runtime, scoped: false }, {
    codeMode: true, environment,
    executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, maxActiveCells: 3, interruptTimeoutMs: graceMs }),
  });
  onCleanup(() => owner.close());
  const finished = [];
  onCleanup(owner.subscribeFinished((entry) => finished.push(entry)));
  const generations = new Set();
  onCleanup(owner.subscribe(({ kernelId }) => { if (kernelId) generations.add(kernelId); }));

  const start = async (title, mode, { outputs, ...body } = {}) => {
    const call = await within(owner.tool.execute(title, { title, mode, yield_s: 0, code: witness.code(title, body),
      ...(outputs === undefined ? {} : { outputs }) }), `yield ${title}`);
    assert.equal(Boolean(call.isError), false, text(call));
    const { cell_id: id, status } = JSON.parse(text(call));
    assert.equal(status, "running");
    const peer = await witness.peer(title);
    // Readiness is sent immediately before a blocking recv; no byte is sent until the test releases the peer.
    await until(() => ownedProc(peer.leader)?.state === "S", `${title} sleeping in the native wait`);
    return { id, title, mode, kernelId: call.details.kernelId, ...peer };
  };
  const resultFor = (cell) => until(() => finished.find(({ cellId }) => cellId === cell.id)?.result, `${cell.title} finished`);
  const live = (...cells) => {
    const snapshot = owner.getSnapshot();
    assert.equal(snapshot.connectionStatus, "connected");
    assert.deepEqual(new Set(snapshot.activeCells.map(({ cellId, mode, status }) => `${cellId}:${mode}:${status}`)),
      new Set(cells.map(({ id, mode }) => `${id}:${mode}:running`)));
  };
  const foreground = async (title, code) => {
    const result = await within(owner.executeForeground(title, { mode: "thread", code }), `${title} finished`);
    assert.equal(result.details.outcome, "ok", text(result));
    return result;
  };
  const eof = ({ title, socket }) => until(() => {
    assert(!socket.destroyed || socket.readableEnded, `${title} reset instead of reaching EOF`);
    return socket.readableEnded;
  }, `${title} socket EOF`);

  const thread = await start("Shared thread", "thread", { setup: "shared_marker = stop_binding = [41]" });
  const generation = thread.kernelId, runner = thread.leader;
  const effect = join(tempRoot, "a-effect");
  const a = await start("A", "isolated", {
    descendant: true, outputs: "stop_binding", after: "return 'cancelled return must not bind'",
    setup: `print('A stdout before stop')
print('A stderr before stop', file=sys.stderr)
Path(${JSON.stringify(effect)}).write_text('A side effect')`,
  });
  const b = await start("B", "isolated", { outputs: "b_binding", after: "print('B kept running')\nreturn 42" });
  assert.equal(a.kernelId, generation);
  assert.equal(b.kernelId, generation);
  const aProc = ownedProc(a.leader), bProc = ownedProc(b.leader), child = ownedProc(a.child);
  assert(aProc && bProc && child, "A, B, and A's fd-holding child must all be live before cancellation");
  const forkserver = readProc(aProc.parent);
  assert.equal(forkserver.parent, runner.pid, "forkserver belongs to the owned runner");
  assert.equal(bProc.parent, forkserver.pid);
  assert.deepEqual([aProc.group, bProc.group, child.parent, child.group], [aProc.pid, bProc.pid, aProc.pid, aProc.pid]);
  live(thread, a, b);
  await assert.rejects(owner.executeForeground("fourth slot", { code: "raise AssertionError('full kernel admitted this')" }),
    { code: "BUSY", transient: true, submitted: false });
  await until(() => {
    const output = owner.previewCell(a.id)?.output;
    return output?.includes("A stdout before stop") && output.includes("A stderr before stop");
  }, "A's output reached the owner before freezing the runner");

  await withFrozenRunner(runner, until, async () => {
    assert.equal((await owner.requestCellInterrupt(a.id, "auto")).status, "requested");
    const assertFrozenGeneration = () => {
      assert.equal(ownedProc(runner)?.state, "T", "the owned runner stayed frozen");
      const snapshot = owner.getSnapshot();
      assert.equal(snapshot.kernelId, generation);
      assert.equal(snapshot.connectionStatus, "connected", "isolated stop must not retire the runner");
      assert.equal(owner.previewCell(b.id)?.status, "running");
      assert.equal(owner.previewCell(thread.id)?.status, "running");
      assert.equal(ownedProc(b.leader)?.state, "S", "B remains blocked and alive");
    };
    await until(() => {
      assertFrozenGeneration();
      return !ownedProc(a.leader); // A zombie is not a reap.
    }, "A physically reaped without the runner processing cancel");
    await eof(a); // The external peer still has not sent a byte to A or its descendant.
    assert(!ownedProc(a.child) || /^[ZX]$/.test(ownedProc(a.child)?.state), "A's descendant stopped too");
    await delay(graceMs + 50);
    assertFrozenGeneration();
  });

  const aborted = await resultFor(a);
  assert.equal(aborted.details.outcome, "aborted");
  assert.equal(aborted.details.mode, "isolated");
  assert.equal(aborted.details.kernelId, generation);
  assert.equal(aborted.details.cause, undefined, "A ended by targeted stop, not retirement");
  assert.match(text(aborted), /A stdout before stop/);
  assert.match(text(aborted), /A stderr before stop/);
  assert.doesNotMatch(text(aborted), /Return \(/);
  assert.deepEqual(await owner.readCell(a.id), aborted);
  assert.equal(await readFile(effect, "utf8"), "A side effect", "cancellation does not roll back effects");
  assert.deepEqual(finished.map(({ cellId }) => cellId), [a.id], "only A finished");
  await assert.rejects(owner.requestCellInterrupt(a.id, "now"), { code: "NOT_FOUND" });
  live(thread, b);
  assert.equal((await foreground("C reuses A's slot", `assert shared_marker is stop_binding and stop_binding == [41]
assert 'b_binding' not in globals()`)).details.kernelId, generation);
  live(thread, b);

  b.socket.write("!");
  const completed = await resultFor(b);
  assert.equal(completed.details.outcome, "ok");
  assert.match(text(completed), /B kept running/);
  assert.match(text(completed), /Return \(int\): 42/);
  assert.doesNotMatch(text(completed), /A stdout|A stderr/);
  await foreground("Inspect bindings", "assert shared_marker is stop_binding and shared_marker == [41] and b_binding == 42");

  const d = await start("Now initiator", "isolated"), e = await start("Now isolated peer", "isolated");
  live(thread, d, e);
  const affected = [thread, d, e].map(({ id, title }) => ({ kernelId: generation, cellId: id, taskName: title }));
  const assertRetirement = (details) => {
    assert.equal(details.kernelId, generation);
    assert.equal(details.cause, "interrupt-now");
    assert.equal(details.initiatorCellId, d.id);
    assert.equal(details.reason, "kernel 重启");
    assert.deepEqual(new Set(details.affectedCells), new Set(affected));
  };
  await withFrozenRunner(runner, until, async () => {
    const now = await within(owner.requestCellInterrupt(d.id, "now"), "now retirement with the runner stopped");
    assert.equal(now.status, "retired");
    assertRetirement(now);
    for (const cell of [thread, d, e]) {
      assert.equal(ownedProc(cell.leader), undefined, `${cell.title} reaped before test SIGCONT`);
      await eof(cell);
      const result = await resultFor(cell);
      assert.equal(result.details.outcome, "aborted");
      assertRetirement(result.details);
    }
  });
  assert.deepEqual(await owner.readCell(a.id), aborted, "retirement does not rewrite A's settled result");
  assert.deepEqual(await owner.readCell(b.id), completed, "retirement does not rewrite B's settled result");
  assert.deepEqual(new Set(finished.map(({ cellId }) => cellId)), new Set([a.id, b.id, thread.id, d.id, e.id]));
  assert.equal(finished.length, 5, "each yielded cell settled once");
  await delay(graceMs + 50);
  const retired = owner.getSnapshot();
  assert.equal(retired.state, "unavailable");
  assert.equal(retired.kernelId, generation);
  assert.deepEqual(retired.activeCells, []);
  assert.deepEqual([...generations], [generation], "now never respawns a generation in the background");

  const fresh = await start("Explicit new generation", "thread", { setup: "assert 'shared_marker' not in globals()" });
  assert.notEqual(fresh.kernelId, generation);
  assert.equal(owner.interruptCell(generation, fresh.id, "user"), false, "stale generation cannot stop a current cell");
  await assert.rejects(owner.requestCellInterrupt(d.id, "now"), { code: "NOT_FOUND" });
  live(fresh);
  fresh.socket.write("!");
  assert.equal((await resultFor(fresh)).details.outcome, "ok");
  finished.forEach((entry) => entry.release());

  console.log("PASS isolated stop: frozen runner, observed reap and EOF, slot reuse, and explicit retirement without respawn");
}, { tempParent: "/tmp" });
