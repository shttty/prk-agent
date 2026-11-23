import assert from "node:assert/strict";
import { join } from "node:path";

export async function checkParentContamination({ owner, repoRoot, home, spawn, call, get, idle, peers, entries, text }) {
  const child = await spawn(owner, { label: "Parent contamination guard", isolated: true });
  const row = structuredClone(get(child)), beforeReceipts = (await entries(owner)).filter((entry) => entry.type === "custom" && entry.customType === "gateway-derived-receipt").length;
  await call(child, "kernel_code", { code: [
    "from pathlib import Path",
    "Path('guard-change.txt').write_text('isolated result\\n')",
    `Path(${JSON.stringify(join(repoRoot, "parent-untracked.bin"))}).write_bytes(b'contaminated\\x00parent')`,
    "print('PARENT_CONTENT_CHANGED_WITH_IDENTICAL_UNTRACKED_STATUS')",
  ].join("\n") });
  const rejected = await call(child, "session_result", { summary: "Guarded isolated result", artifacts: [] }, /Parent checkout changed.*session_result refused/iu);
  assert.match(text(rejected), /Inspect the parent repository/u);
  assert.equal(get(child).derivation.phase, "working");
  assert.equal(Object.hasOwn(get(child).derivation, "result"), false, "Parent contamination cannot persist a successful result");
  assert.equal((await entries(owner)).filter((entry) => entry.type === "custom" && entry.customType === "gateway-derived-receipt").length, beforeReceipts);
  assert(!peers(owner).some(({ body }) => body.includes("Guarded isolated result")), "Rejected result never reaches the parent inbox");
  await call(owner, "kernel_code", { code: [
    `assert Path(${JSON.stringify(join(repoRoot, "parent-untracked.bin"))}).read_bytes() == b'contaminated\\x00parent'`,
    `assert not list(Path(${JSON.stringify(join(home, "artifacts", "patches"))}).glob(${JSON.stringify(`${row.sessionId}-*.patch`)}))`,
    `Path(${JSON.stringify(join(repoRoot, "parent-untracked.bin"))}).write_bytes(b'parent\\x00untracked\\xff')`,
    "assert parent_snapshot() == subsession_parent_before",
    "print('PARENT_RESTORED_AFTER_REJECTED_RESULT')",
  ].join("\n") });
  const submitted = await call(child, "session_result", { summary: "Guarded isolated result", artifacts: [] });
  assert(submitted.patch, "After an explicit parent repair the same unsubmitted task can produce its real patch");
  await idle(owner);
  assert.equal(peers(owner).filter(({ body }) => body.includes(submitted.resultId)).length, 1);
  await call(owner, "session_manage", { action: "destroy", child });
  await call(owner, "kernel_code", { code: `assert not Path(${JSON.stringify(row.derivation.worktreeRoot)}).exists()\nassert parent_snapshot() == subsession_parent_before\nprint('CONTAMINATION_GUARD_RECOVERY_COMPLETE')` });
}
