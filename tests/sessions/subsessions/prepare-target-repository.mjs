import assert from "node:assert/strict";
import { join } from "node:path";

export async function prepareTargetRepository({ tempRoot, create, call, text, get }) {
  const repoRoot = join(tempRoot, "subsession-repository"), baseCwd = join(repoRoot, "project");
  const bootstrap = await create("Repository bootstrap");
  const setup = await call(bootstrap, "kernel_code", { code: [
    "from pathlib import Path",
    "import subprocess, json",
    `repo = Path(${JSON.stringify(repoRoot)})`,
    "(repo / 'project').mkdir(parents=True)",
    "def setup_git(*args): return subprocess.check_output(['git', '-C', str(repo), *args], text=True)",
    "setup_git('init', '--quiet')",
    "for name in ('committed.txt', 'unstaged.txt', 'staged.txt'): (repo / 'project' / name).write_text('base\\n')",
    "(repo / 'project' / 'tracked.bin').write_bytes(bytes(range(256)) * 4)",
    "setup_git('add', '-A')",
    "setup_git('-c', 'user.name=Subsession Test', '-c', 'user.email=subsession@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'isolated base')",
    "(repo / 'project' / 'unstaged.txt').write_text('parent-only dirty content\\n')",
    "(repo / 'parent-untracked.bin').write_bytes(b'parent\\x00untracked\\xff')",
    "print('SUBSESSION_BASE=' + setup_git('rev-parse', 'HEAD').strip())",
  ].join("\n") });
  const baseCommit = /SUBSESSION_BASE=([0-9a-f]{40,64})/u.exec(text(setup))?.[1];
  assert(baseCommit, text(setup));
  const owner = await create("Subsession Parent", baseCwd);
  assert.equal(get(owner).cwd, baseCwd);
  await call(owner, "kernel_code", { code: [
    "from pathlib import Path",
    "import subprocess, json, base64",
    `subsession_repo = Path(${JSON.stringify(repoRoot)})`,
    "def parent_snapshot():",
    "    files = {str(path.relative_to(subsession_repo)): base64.b64encode(path.read_bytes()).decode() for path in subsession_repo.rglob('*') if path.is_file() and '.git' not in path.relative_to(subsession_repo).parts}",
    "    return {'files': files, 'head': subprocess.check_output(['git', '-C', str(subsession_repo), 'rev-parse', 'HEAD'], text=True), 'status': subprocess.check_output(['git', '-C', str(subsession_repo), 'status', '--porcelain=v1'], text=True), 'index': subprocess.check_output(['git', '-C', str(subsession_repo), 'diff', '--cached', '--binary'])}",
    "subsession_parent_before = parent_snapshot()",
    "assert 'parent-only dirty content' in (subsession_repo / 'project' / 'unstaged.txt').read_text()",
    "print('PARENT_DIRTY_BASELINE_RECORDED')",
  ].join("\n") });
  return { owner, bootstrap, repoRoot, baseCwd, baseCommit };
}
