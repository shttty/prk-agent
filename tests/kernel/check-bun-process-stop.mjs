import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../../src/kernel/kernel-options.ts";
import { withBunOwner, text } from "./fixtures/create-bun-owner.mjs";

await withBunOwner(async (owner) => {
  const finished = new Map();
  owner.subscribeFinished(({ cellId, result }) => finished.set(cellId, result));
  async function launch(name, code) {
    const result = await owner.tool.execute(name, { code, yield_s: 0 });
    const id = JSON.parse(text(result)).cell_id;
    assert(id);
    return id;
  }
  const pidFor = async (id, name) => {
    let pid;
    await until(() => {
      const output = owner.previewCell(id)?.output ?? "";
      pid = Number(new RegExp(`${name}-pid=(\\d+)`).exec(output)?.[1]);
      return pid > 1;
    }, `missing PID from owned cell ${name}`);
    return pid;
  };
  const spawn = (name) => `const child = cell.spawn(['/bin/sh','-c','printf "${name}-stdout\\n"; printf "${name}-stderr\\n" >&2; exec /bin/sleep 60']);
    console.log('${name}-pid=' + child.pid);
    try { await child.exited; } finally { console.log('${name}-finally'); }`;
  const a = await launch("A", spawn("A"));
  const b = await launch("B", spawn("B"));
  const [aPid, bPid] = await Promise.all([pidFor(a, "A"), pidFor(b, "B")]);
  const generation = owner.getSnapshot().kernelId;
  const result = await owner.requestCellInterrupt(a, "never");
  assert.equal(result.details?.outcome, "aborted", JSON.stringify(result));
  assert.match(text(result), /A-stdout/);
  assert.match(text(result), /A-stderr/);
  assert.match(text(result), /A-finally/);
  assert.doesNotMatch(text(result), /B-stdout|B-stderr|B-finally/);
  assert.equal(await alive(aPid), false, "cell_end preceded child reaping");
  assert.equal(await alive(bPid), true);
  assert.equal(finished.has(b), false);
  assert.equal(owner.getSnapshot().kernelId, generation);

  const blocked = await launch("blocked", `console.log('blocking'); Bun.spawnSync(['/bin/sleep','60']);`);
  await until(() => owner.previewCell(blocked)?.output.includes("blocking"), "spawnSync did not start");
  assert.equal((await owner.requestCellInterrupt(blocked, "auto")).status, "requested");
  await until(() => finished.has(b) && finished.has(blocked), "external grace did not finish retirement");
  for (const id of [b, blocked]) {
    const { details } = finished.get(id);
    assert.equal(details.outcome, "aborted", JSON.stringify(details));
    assert.equal(details.cause, "interrupt-timeout");
    assert.equal(details.initiatorCellId, blocked);
    assert.deepEqual(new Set(details.affectedCells.map(({ cellId }) => cellId)), new Set([b, blocked]));
  }
  assert.equal(await alive(bPid), false);
  assert.notEqual(owner.getSnapshot().connectionStatus, "connected");
}, { executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, interruptTimeoutMs: 750 }) });
console.log("PASS: Bun owned process exit/pipe drain and external retirement of spawnSync");

function alive(pid) { return stat(`/proc/${pid}`).then(() => true, (error) => { if (error.code === "ENOENT") return false; throw error; }); }
async function until(ready, reason) {
  const deadline = Date.now() + 5500;
  while (!ready()) { assert(Date.now() < deadline, reason); await delay(15); }
}
