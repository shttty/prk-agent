import assert from "node:assert/strict";
import { dirname, join } from "node:path";

export async function checkWorktreeResults({ owner, repoRoot, baseCwd, baseCommit, home, tempRoot, spawn, get, call, idle, firstRequest, peers, entries, saveDerivation, text }) {
  await saveDerivation({ defaultIsolated: false, roles: { isolated: { isolated: true } } });
  const child = await spawn(owner, { label: "Remote binary patch", role: "isolated", target: "remote", cwd: baseCwd });
  const row = get(child), identity = structuredClone(row.derivation);
  assert.equal(row.target, "remote", "The isolated admission selects the nonlocal target route");
  assert.equal(identity.isolated, true, "Role isolation overrides global false");
  assert.equal(identity.repoRoot, repoRoot);
  assert.equal(identity.baseCommit, baseCommit);
  assert.equal(identity.worktreeRoot, join(tempRoot, ".cache", "prk-worktrees", row.sessionId), "Worktree is created under target HOME, not Gateway HOME");
  assert.equal(row.cwd, join(identity.worktreeRoot, "project"), "Repository-relative child cwd survives isolation");
  const prompt = firstRequest("Remote binary patch").prompt;
  assert(prompt.includes(identity.worktreeRoot) && prompt.includes(repoRoot) && /parent checkout/u.test(prompt), "The actual child prompt identifies its worktree and forbidden parent checkout");
  const changed = await call(child, "kernel_code", { code: [
    "from pathlib import Path",
    "import os, subprocess",
    `child_root = Path(${JSON.stringify(identity.worktreeRoot)})`,
    `assert Path.cwd() == Path(${JSON.stringify(row.cwd)})`,
    `assert os.environ.get('GIT_CEILING_DIRECTORIES') == ${JSON.stringify(dirname(identity.worktreeRoot))}`,
    "def child_git(*args): return subprocess.check_output(['git', '-C', str(child_root), *args], text=True)",
    "assert subprocess.run(['git', '-C', str(child_root), 'symbolic-ref', '-q', 'HEAD'], capture_output=True).returncode == 1",
    "assert Path('unstaged.txt').read_text() == 'base\\n', 'Parent dirty content leaked into child'",
    "Path('committed.txt').write_text('child committed content\\n')",
    "Path('tracked.bin').write_bytes(bytes(reversed(range(256))) * 5)",
    "child_git('add', 'project/committed.txt', 'project/tracked.bin')",
    "child_git('-c', 'user.name=Subsession Test', '-c', 'user.email=subsession@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'child commit')",
    "Path('unstaged.txt').write_text('child unstaged content\\n')",
    "Path('staged.txt').write_text('child staged content\\n')",
    "child_git('add', 'project/staged.txt')",
    "Path('untracked.bin').write_bytes(b'new\\x00binary\\xff\\x80' * 79)",
    "child_index_before = child_git('diff', '--cached', '--binary')",
    "child_head_before = child_git('rev-parse', 'HEAD')",
    "assert child_git('status', '--porcelain=v1').strip()",
    "print('REMOTE_COMMITTED_UNSTAGED_STAGED_UNTRACKED_BINARY_READY')",
  ].join("\n") });
  assert.match(text(changed), /REMOTE_COMMITTED_UNSTAGED_STAGED_UNTRACKED_BINARY_READY/u);
  await call(owner, "kernel_code", { code: "assert parent_snapshot() == subsession_parent_before\nprint('PARENT_UNTOUCHED_BEFORE_RESULT')" });
  const submitted = await call(child, "session_result", { summary: "Complete isolated binary changes", artifacts: ["explicit-report.txt"], output: { complete: true } });
  await idle(owner);
  const result = get(child).derivation.result, patch = result.patch;
  assert(patch, "An isolated result returns a real binary patch artifact");
  assert.equal(patch.path, join(home, "artifacts", "patches", `${row.sessionId}-${identity.taskId}.patch`));
  assert(Number.isInteger(patch.bytes) && patch.bytes > 0);
  for (const filename of ["committed.txt", "unstaged.txt", "staged.txt", "tracked.bin", "untracked.bin"]) assert(patch.stats.includes(filename), `Patch stats include ${filename}`);
  assert.match(patch.stats, /5 files changed/u);
  assert.deepEqual(submitted.patch, patch, "The SDK session_result response includes the same patch metadata");
  assert.deepEqual(result.artifacts, ["explicit-report.txt", patch.path]);
  const messages = peers(owner).filter(({ body }) => body.includes(submitted.resultId));
  assert.equal(messages.length, 1, "One result enters the existing parent inbox without polling or acknowledgment");
  const notice = JSON.parse(messages[0].body.split("\n").find((line) => line.startsWith("{")));
  assert.equal(notice.child, child);
  assert.equal(notice.taskId, identity.taskId);
  assert.deepEqual(notice.result.patch, patch);
  assert.deepEqual(notice.result.artifacts, result.artifacts);
  const receipts = (await entries(owner)).filter((entry) => entry.type === "custom" && entry.customType === "gateway-derived-receipt" && entry.data.child === child);
  assert.equal(receipts.length, 1);
  assert.deepEqual(receipts[0].data.result.patch, patch, "Native owner receipt persists the delivered patch metadata");
  await call(child, "kernel_code", { code: [
    "assert child_git('diff', '--cached', '--binary') == child_index_before, 'Patch generation changed the child index'",
    "assert child_git('rev-parse', 'HEAD') == child_head_before, 'Patch generation changed child commits'",
    "print('CHILD_INDEX_AND_COMMITS_PRESERVED')",
  ].join("\n") });
  const applied = await call(owner, "kernel_code", { code: [
    `patch_path = Path(${JSON.stringify(patch.path)})`,
    `assert patch_path.stat().st_size == ${patch.bytes}`,
    "assert b'GIT binary patch' in patch_path.read_bytes()",
    "assert parent_snapshot() == subsession_parent_before",
    "apply_root = subsession_repo",
    "subprocess.run(['git', '-C', str(apply_root), 'restore', '--staged', '--worktree', '--', 'project/unstaged.txt'], check=True)",
    "applied_patch = subprocess.run(['git', '-C', str(apply_root), 'apply', '--3way', str(patch_path)], capture_output=True, text=True)",
    "assert applied_patch.returncode == 0, applied_patch.stderr",
    "assert (apply_root / 'project' / 'committed.txt').read_text() == 'child committed content\\n'",
    "assert (apply_root / 'project' / 'unstaged.txt').read_text() == 'child unstaged content\\n'",
    "assert (apply_root / 'project' / 'staged.txt').read_text() == 'child staged content\\n'",
    "assert (apply_root / 'project' / 'tracked.bin').read_bytes() == bytes(reversed(range(256))) * 5",
    "assert (apply_root / 'project' / 'untracked.bin').read_bytes() == b'new\\x00binary\\xff\\x80' * 79",
    "assert (apply_root / 'parent-untracked.bin').read_bytes() == b'parent\\x00untracked\\xff'",
    `subprocess.run(['git', '-C', str(apply_root), 'restore', '--source=${baseCommit}', '--staged', '--worktree', '--', 'project'], check=True)`,
    "(apply_root / 'project' / 'unstaged.txt').write_text('parent-only dirty content\\n')",
    "assert parent_snapshot() == subsession_parent_before, 'Isolation changed the parent files, index or HEAD'",
    "print('COMPLETE_BINARY_PATCH_APPLIED_THREE_WAY_PARENT_UNTOUCHED')",
  ].join("\n") });
  assert.match(text(applied), /COMPLETE_BINARY_PATCH_APPLIED_THREE_WAY_PARENT_UNTOUCHED/u);
  await call(owner, "session_send", { to: row.sessionId, message: "Persistent continuation: stay in your existing worktree and await the next tool.", delivery: "steer", expectReply: false });
  await idle(child);
  await call(child, "kernel_code", { code: `assert str(Path.cwd()) == ${JSON.stringify(row.cwd)}\nassert Path('untracked.bin').exists()\nprint('PERSISTENT_WORKTREE_CONTINUATION')` });
  await call(owner, "session_manage", { action: "destroy", child });
  assert.equal(get(child), undefined);
  const removed = await call(owner, "kernel_code", { code: [
    `assert not Path(${JSON.stringify(identity.worktreeRoot)}).exists()`,
    `assert ${JSON.stringify(identity.worktreeRoot)} not in subprocess.check_output(['git', '-C', str(subsession_repo), 'worktree', 'list', '--porcelain'], text=True)`,
    "assert patch_path.exists(), 'Archiving removed the delivered artifact'",
    "assert parent_snapshot() == subsession_parent_before",
    "print('REMOTE_WORKTREE_ARCHIVE_CLEANUP_COMPLETE')",
  ].join("\n") });
  assert.match(text(removed), /REMOTE_WORKTREE_ARCHIVE_CLEANUP_COMPLETE/u);
  await saveDerivation({});
}
