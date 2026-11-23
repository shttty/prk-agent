import assert from "node:assert/strict";
import { dirname, join } from "node:path";

export async function checkIsolationLifecycle({ owner, home, host, client, spawn, call, get, idle, text }) {
  const clean = await spawn(owner, { label: "Clean local worktree", isolated: true });
  const cleanRow = get(clean), cleanRoot = cleanRow.derivation.worktreeRoot;
  const bash = await call(clean, "bash", { command: "printf '%s\\n' \"$GIT_CEILING_DIRECTORIES\"" });
  assert.equal(text(bash).trim(), dirname(cleanRoot), "Real local native Bash receives the isolation ceiling");
  await call(clean, "kernel_code", { code: [
    "from pathlib import Path",
    "import os, subprocess",
    `assert os.environ['GIT_CEILING_DIRECTORIES'] == ${JSON.stringify(dirname(cleanRoot))}`,
    `assert Path.cwd() == Path(${JSON.stringify(cleanRow.cwd)})`,
    "assert not subprocess.check_output(['git', 'status', '--porcelain=v1'], text=True).strip()",
    "print('CLEAN_ISOLATED_WORKTREE')",
  ].join("\n") });
  const cleanSubmission = await call(clean, "session_result", { summary: "No repository changes", artifacts: [] });
  await idle(owner);
  assert.equal(Object.hasOwn(cleanSubmission, "patch"), false, "No-change SDK result omits patch metadata");
  assert.equal(Object.hasOwn(get(clean).derivation.result, "patch"), false);
  assert.deepEqual(get(clean).derivation.result.artifacts, []);
  const cleanFiles = await call(owner, "kernel_code", { code: [
    `assert not list(Path(${JSON.stringify(join(home, "artifacts", "patches"))}).glob(${JSON.stringify(`${cleanRow.sessionId}-*.patch`)}))`,
    "assert parent_snapshot() == subsession_parent_before",
    "print('NO_CHANGE_PATCH_FILE_ABSENT')",
  ].join("\n") });
  assert.match(text(cleanFiles), /NO_CHANGE_PATCH_FILE_ABSENT/u);
  await call(owner, "session_manage", { action: "destroy", child: clean });
  await call(owner, "kernel_code", { code: `assert not Path(${JSON.stringify(cleanRoot)}).exists()\nprint('CLEAN_WORKTREE_REMOVED')` });
  const branchOwner = await spawn(owner, { label: "Upgrade retention owner", isolated: false });
  const upgraded = await spawn(branchOwner, { label: "Retained user worktree", isolated: true });
  const retained = structuredClone(get(upgraded));
  await call(upgraded, "kernel_code", { code: "from pathlib import Path\nPath('retained-user.txt').write_text('user-owned worktree\\n')\nretained_user_variable = 917" });
  const upgrade = await client.request("manageSession", { sessionId: get(upgraded).sessionId, action: "upgrade" });
  assert(upgrade);
  assert.equal(get(upgraded).derivation.lifecycle, "user");
  assert.equal(get(upgraded).derivation.owner, null);
  assert.equal(get(upgraded).cwd, retained.cwd);
  await call(owner, "session_manage", { action: "destroy", child: branchOwner });
  assert(get(upgraded), "Archiving the creator retains the explicitly upgraded user session");
  await call(upgraded, "kernel_code", { code: [
    `assert Path.cwd() == Path(${JSON.stringify(retained.cwd)})`,
    "assert Path('retained-user.txt').read_text() == 'user-owned worktree\\n'",
    "assert retained_user_variable == 917",
    "print('USER_UPGRADE_RETAINS_WORKTREE_AND_KERNEL')",
  ].join("\n") });
  await host.archiveSession(get(upgraded).sessionId, { confirm: true });
  assert.equal(get(upgraded), undefined);
  await call(owner, "kernel_code", { code: [
    `assert Path(${JSON.stringify(retained.derivation.worktreeRoot)}).is_dir()`,
    `assert Path(${JSON.stringify(join(retained.cwd, "retained-user.txt"))}).read_text() == 'user-owned worktree\\n'`,
    "assert parent_snapshot() == subsession_parent_before",
    "print('UPGRADED_USER_WORKTREE_RETAINED_ON_ARCHIVE')",
  ].join("\n") });
}
