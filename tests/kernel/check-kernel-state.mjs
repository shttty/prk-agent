import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

await withTargetFixture(async ({ runtime, tempRoot, onCleanup }) => {
  const python = createPythonTool(runtime, { codeMode: true });
  onCleanup(() => python.close());
  assert.deepEqual(python.getSnapshot(), { state: "not_started", language: "python", activeCells: [] });
  const observed = [], unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  const unsubscribe = python.subscribe((snapshot) => observed.push(snapshot));
  const rejected = python.subscribe(async () => { throw new Error("Owned observer failure"); });
  try {
    const result = await python.tool.execute("first", { code: "x=41" });
    assert.equal(result.isError, undefined);
    assert.equal(python.getSnapshot().state, "idle");
    assert.equal(python.getSnapshot().lastOutcome, "ok");
    assert(observed.some(({ state }) => state === "starting"));
    assert(observed.some(({ state }) => state === "busy"));
    const failure = await python.tool.execute("error", { code: "raise ValueError('owned error')" });
    assert.equal(failure.isError, true);
    assert.equal(python.getSnapshot().lastOutcome, "error");
    assert(observed.filter(({ state }) => state === "busy").every(({ lastOutcome }) => lastOutcome === undefined), "Busy snapshots clear previous outcomes");
    await delay(0);
    assert.deepEqual(unhandled, [], "Rejected observers never leak unhandled promises");
  } finally {
    rejected(); unsubscribe(); process.removeListener("unhandledRejection", onUnhandled);
  }
  let reentrant;
  const stopWatching = python.subscribe((snapshot) => { if (snapshot.state === "closing") reentrant = python.close(); });
  const closing = python.close();
  assert.strictEqual(reentrant, closing, "Reentrant closing shares the same cleanup promise");
  await closing;
  stopWatching();
  assert.equal(python.getSnapshot().state, "closed");
  for (const phase of ["starting", "idle", "busy"]) {
    const owner = createPythonTool(runtime, { codeMode: true });
    onCleanup(() => owner.close());
    if (phase === "busy") await owner.tool.execute("warm", { code: "x=1" });
    const marker = join(tempRoot, `${phase}-must-not-submit`);
    let close;
    const off = owner.subscribe((snapshot) => {
      if (snapshot.state === phase && close === undefined) close = owner.close();
    });
    try {
      const outcome = await owner.tool.execute(`close-${phase}`, { code: `open(${JSON.stringify(marker)},'w').write('SIDE_EFFECT')` }).then((value) => ({ value }), (error) => ({ error }));
      assert(close, `Observer reached ${phase}`);
      await close;
      assert(outcome.error || outcome.value.isError, `Closure at ${phase} refuses execution`);
      assert.equal(existsSync(marker), false, `Closure at ${phase} cannot submit user code`);
      assert.equal(owner.getSnapshot().state, "closed");
    } finally { off(); }
  }
});
console.log("PASS real REPL state: lazy startup, outcomes, observer isolation and reentrant close admission guards");
