// The collector script itself: fake /proc and real temporary git directories, driven over its stdin/stdout protocol.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openCollector } from "./collector/open-collector.mjs";

const python = process.env.PI_TEST_PYTHON ?? "python3";
const root = await mkdtemp(join(tmpdir(), "prk-collector-"));
const git = (cwd, ...args) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, stdio: "ignore" });

const pythonPath = python.includes("/") ? python : execFileSync("which", [python]).toString().trim();
const collectors = [];
const run = (...args) => {
  const collector = openCollector(pythonPath, ...args);
  collectors.push(collector);
  return collector;
};

try {
  // ---- fake /proc: CPU percentage, load, memory
  const proc = join(root, "proc");
  await mkdir(proc);
  const stat = (user, idle) => `cpu  ${user} 0 0 ${idle} 0 0 0 0 0 0\ncpu0 ${user} 0 0 ${idle} 0 0 0 0 0 0\ncpu1 ${user} 0 0 ${idle} 0 0 0 0 0 0\nintr 1\n`;
  await writeFile(join(proc, "stat"), stat(100, 900));
  await writeFile(join(proc, "loadavg"), "1.50 0.75 0.25 1/100 999\n");
  await writeFile(join(proc, "meminfo"), "MemTotal:       2048 kB\nMemFree:         100 kB\nMemAvailable:    512 kB\n");
  const emptyPath = join(root, "empty-path");
  await mkdir(emptyPath);
  const metrics = run(["--proc", proc], { PATH: emptyPath });
  const hello = await metrics.next((message) => message.t === "hello");
  assert.equal(typeof hello.message.version, "number");
  // The baseline was read at start; this lands inside the 0.2 s warm-up: +60 busy, +40 idle of 100 => 60 %.
  await writeFile(join(proc, "stat"), stat(160, 940));
  const machine = (await metrics.next((message) => message.t === "machine")).message;
  assert.equal(machine.cpu.pct, 60);
  assert.equal(machine.cpu.cores, 2);
  assert.deepEqual(machine.load, [1.5, 0.75, 0.25]);
  assert.deepEqual(machine.mem, { total: 2048 * 1024, available: 512 * 1024 });
  assert(machine.disk.total > 0 && machine.disk.free >= 0);
  assert.deepEqual(machine.gpus, [], "no nvidia-smi on PATH: no GPU entries");
  // A missing /proc degrades to nulls instead of killing the collector.
  await rm(proc, { recursive: true });
  metrics.send({ op: "config", intervalMs: 1000 });
  const degraded = (await metrics.next((message) => message.t === "machine", 2)).message;
  assert.equal(degraded.cpu.pct, null);
  assert.equal(degraded.load, null);
  assert.equal(degraded.mem, null);
  // Runtime liveness controls are gone; business sampling continues without Gateway input.
  metrics.send({ id: 91, mod: "runtime", op: "ping" });
  assert.match((await metrics.next((message) => message.re === 91)).message.error, /unknown runtime operation/);
  metrics.send({ id: 92, mod: "runtime", op: "config", heartbeatTimeoutMs: 300 });
  assert.match((await metrics.next((message) => message.re === 92)).message.error, /unknown runtime operation/);
  const quiet = metrics.count();
  await metrics.next((message) => message.t === "machine", quiet);
  assert.equal(metrics.child.exitCode, null, "sampling ticks do not need heartbeat input");
  metrics.send({ op: "quit" });
  assert.equal((await metrics.exited)[0], 0);

  // ---- git directories
  const repo = join(root, "repo");
  await mkdir(join(repo, "sub"), { recursive: true });
  git(repo, "init", "-q", ".");
  await writeFile(join(repo, "keep.txt"), "one\ntwo\nthree\n");
  await writeFile(join(repo, "gone.txt"), "a\nb\n");
  await writeFile(join(repo, "sub", "tracked.txt"), "x\n");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "init");
  await writeFile(join(repo, "keep.txt"), "one\nTWO\nthree\nfour\n"); // +2 -1 unstaged
  await writeFile(join(repo, "staged.txt"), "s1\ns2\n"); // new + staged: +2
  git(repo, "add", "staged.txt");
  await writeFile(join(repo, "untracked.txt"), "u1\nu2\nu3"); // untracked, no trailing newline: +3
  await writeFile(join(repo, "blob.bin"), Buffer.from([1, 0, 2]));
  await rm(join(repo, "gone.txt")); // deleted: -2
  const plain = join(root, "plain");
  await mkdir(plain);
  const fresh = join(root, "fresh"); // repo without a commit
  await mkdir(fresh);
  git(fresh, "init", "-q", ".");
  await writeFile(join(fresh, "new.txt"), "n\n");

  const watcher = run();
  await watcher.next((message) => message.t === "hello");
  watcher.send({ op: "config", intervalMs: 600000 });
  watcher.send({ op: "watch", dirs: [join(repo, "sub"), plain, fresh, join(root, "does-not-exist")] });
  const dirOf = async (dir, from = 0) => (await watcher.next((message) => message.t === "dir" && message.dir === dir, from)).message;
  const inRepo = await dirOf(join(repo, "sub"));
  assert.equal(inRepo.git, true, "a subdirectory of a work tree is git");
  assert.equal(inRepo.error, null);
  const byPath = Object.fromEntries(inRepo.files.map((file) => [file.path, file]));
  assert.deepEqual(Object.keys(byPath).sort(), ["blob.bin", "gone.txt", "keep.txt", "staged.txt", "untracked.txt"]);
  assert.deepEqual([byPath["keep.txt"].status, byPath["keep.txt"].added, byPath["keep.txt"].removed], ["M", 2, 1]);
  assert.deepEqual([byPath["staged.txt"].status, byPath["staged.txt"].added, byPath["staged.txt"].removed], ["A", 2, 0]);
  assert.deepEqual([byPath["gone.txt"].status, byPath["gone.txt"].added, byPath["gone.txt"].removed], ["D", 0, 2]);
  assert.deepEqual([byPath["untracked.txt"].status, byPath["untracked.txt"].added], ["?", 3]);
  assert.equal(byPath["blob.bin"].binary, true);
  assert.equal(inRepo.added, 2 + 2 + 3);
  assert.equal(inRepo.removed, 1 + 2);
  assert.equal(inRepo.truncated, false);
  assert(inRepo.disk.total > 0);
  const notGit = await dirOf(plain);
  assert.equal(notGit.git, false);
  assert.deepEqual(notGit.files, []);
  assert(notGit.disk.total > 0, "disk is reported for non-git directories too");
  const noCommit = await dirOf(fresh);
  assert.equal(noCommit.git, true);
  assert.deepEqual(noCommit.files.map((file) => [file.path, file.added]), [["new.txt", 1]], "a repo without HEAD still lists its files");
  assert.equal((await dirOf(join(root, "does-not-exist"))).git, false, "a missing directory is not an error");

  // refresh re-reads one directory right now, even with a ten-minute interval.
  await writeFile(join(repo, "later.txt"), "l\n");
  const before = watcher.count();
  watcher.send({ op: "refresh", dir: join(repo, "sub") });
  const refreshed = await dirOf(join(repo, "sub"), before);
  assert(refreshed.files.some((file) => file.path === "later.txt"));
  watcher.send({ op: "refresh", dir: plain + "-unwatched" });

  // diff: tracked (git diff HEAD), untracked (no-index), outside any repo
  watcher.send({ op: "diff", id: 11, dir: join(repo, "sub"), path: "keep.txt" });
  const tracked = (await watcher.next((message) => message.t === "diff" && message.id === 11)).message;
  assert.equal(tracked.error, null);
  assert(tracked.text.includes("-two") && tracked.text.includes("+TWO") && tracked.text.includes("+four"));
  watcher.send({ op: "diff", id: 12, dir: join(repo, "sub"), path: "untracked.txt" });
  const untracked = (await watcher.next((message) => message.t === "diff" && message.id === 12)).message;
  assert.equal(untracked.error, null);
  assert(untracked.text.includes("+u1") && untracked.text.includes("+u3"));
  watcher.send({ op: "diff", id: 13, dir: plain, path: "x" });
  assert.match((await watcher.next((message) => message.t === "diff" && message.id === 13)).message.error, /not a git/);

  // watch replaces the set: dropped directories stop being sampled.
  const mark = watcher.count();
  watcher.send({ op: "watch", dirs: [plain] });
  watcher.send({ op: "config", intervalMs: 500 });
  await watcher.next((message) => message.t === "machine", mark);
  await new Promise((resolve) => setTimeout(resolve, 600));
  const sampled = watcher.since(mark).filter((message) => message.t === "disk");
  assert(sampled.length > 0 && sampled.every((message) => message.dir === plain), "only the remaining watched directory is sampled");
  watcher.send({ op: "quit" });
  assert.equal((await watcher.exited)[0], 0, "quit exits cleanly");

  // EOF on stdin also ends it.
  const eof = run();
  await eof.next((message) => message.t === "hello");
  eof.child.stdin.end();
  assert.equal((await eof.exited)[0], 0);

  // ---- git's own repository discovery (`git rev-parse --show-toplevel`), asked on watch and on refresh, never on the tick
  const reasonOf = async (c, dir, from = 0) => (await c.next((message) => message.t === "dir" && message.dir === dir, from)).message;
  // a residual empty .git file, and a .git pointing at a deleted worktree: git refuses, so the agent source applies, with the reason
  const emptyGit = join(root, "emptygit");
  const danglingGit = join(root, "dangling");
  await mkdir(emptyGit);
  await mkdir(danglingGit);
  await writeFile(join(emptyGit, ".git"), "");
  await writeFile(join(danglingGit, ".git"), `gitdir: ${join(root, "gone", ".git", "worktrees", "x")}\n`);
  // a linked worktree of `repo`, with a change of its own
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "all");
  const linked = join(root, "linked");
  git(repo, "worktree", "add", "-q", "-b", "wt", linked);
  await mkdir(join(linked, "deep"));
  await writeFile(join(linked, "keep.txt"), "one\nTWO\nthree\nfour\nfive\n"); // vs the commit: +1
  // later `git init` in a plain directory, and a repository that vanishes under the collector
  const later = join(root, "later");
  const fragile = join(root, "fragile");
  await mkdir(later);
  await mkdir(fragile);
  git(fragile, "init", "-q", ".");
  await writeFile(join(fragile, "f.txt"), "f\n");
  const probe = run();
  await probe.next((message) => message.t === "hello");
  probe.send({ op: "config", intervalMs: 600000 });
  probe.send({ op: "watch", dirs: [emptyGit, danglingGit, join(linked, "deep"), later, fragile] });
  for (const dir of [emptyGit, danglingGit]) {
    const sample = await reasonOf(probe, dir);
    assert.equal(sample.git, false, `${dir}: git itself refuses`);
    assert.equal(sample.unavailable, true, `${dir}: that is "git cannot decide", not "no repository"`);
    assert(sample.reason && sample.reason.length > 0 && sample.reason.length <= 200, `${dir}: carries git's first stderr line (${sample.reason})`);
    assert.deepEqual(sample.files, []);
  }
  const inLinked = await reasonOf(probe, join(linked, "deep"));
  assert.equal(inLinked.git, true, "a linked worktree is recognised");
  assert.deepEqual(inLinked.files.map((file) => [file.path, file.status, file.added, file.removed]), [["keep.txt", "M", 1, 0]], "and shows its own changes, not the main work tree's");
  const plainLater = await reasonOf(probe, later);
  assert.deepEqual([plainLater.git, plainLater.unavailable], [false, false], "a plain directory is just not a repository");
  assert.match(plainLater.reason, /not a git repository/);

  // the sampling tick asks git nothing: a repository created afterwards shows only on an explicit refresh
  git(later, "init", "-q", ".");
  probe.send({ op: "config", intervalMs: 500 });
  const tickMark = probe.count();
  await probe.next((message) => message.t === "disk" && message.dir === later, tickMark);
  assert.equal(probe.since(tickMark).some((message) => message.t === "dir" && message.dir === later), false, "the tick sends no git sample");
  // an explicit refresh asks git again
  probe.send({ op: "refresh", dir: later });
  const markRefresh = probe.count();
  assert.equal((await reasonOf(probe, later, markRefresh)).git, true, "refresh re-asks git");
  // a repository removed under the collector: the next explicit refresh says it is no repository
  await rm(join(fragile, ".git"), { recursive: true });
  const afterBreak = probe.count();
  probe.send({ op: "refresh", dir: fragile });
  const gone = await reasonOf(probe, fragile, afterBreak);
  assert.deepEqual([gone.git, gone.unavailable, /not a git repository/.test(gone.reason)], [false, false, true], "a removed repository is seen by the next refresh");
  probe.send({ op: "quit" });
  await probe.exited;

  // safe.directory: git's ownership check refuses a repository owned by someone else. The test cannot chown, so it uses
  // git's own test switch GIT_TEST_ASSUME_DIFFERENT_OWNER (the same check, honoured by release builds), and then lifts the
  // refusal with a safe.directory entry passed through GIT_CONFIG_*.
  const foreign = (extra = {}) => run([], { GIT_TEST_ASSUME_DIFFERENT_OWNER: "1", ...extra });
  const dubious = foreign();
  await dubious.next((message) => message.t === "hello");
  dubious.send({ op: "watch", dirs: [repo] });
  const refused = await reasonOf(dubious, repo);
  assert.deepEqual([refused.git, refused.unavailable], [false, true], "dubious ownership: git cannot decide");
  assert.match(refused.reason, /dubious ownership/);
  dubious.send({ op: "quit" });
  await dubious.exited;
  const trusted = foreign({ GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" });
  await trusted.next((message) => message.t === "hello");
  trusted.send({ op: "watch", dirs: [repo] });
  assert.equal((await reasonOf(trusted, repo)).git, true, "safe.directory lifts the refusal");
  trusted.send({ op: "quit" });
  await trusted.exited;

  // no git binary on the target
  const bare = run([], { PATH: join(root, "no-such-bin") });
  await bare.next((message) => message.t === "hello");
  bare.send({ op: "watch", dirs: [repo] });
  const noGit = await reasonOf(bare, repo);
  assert.deepEqual([noGit.git, noGit.unavailable], [false, true]);
  assert(noGit.reason.length > 0, `a missing git is reported as a reason (${noGit.reason})`);
  bare.send({ op: "quit" });
  await bare.exited;
  console.log("PASS collector protocol, /proc metrics, git changes, git's own repository discovery");
} finally {
  for (const { child } of collectors) child.stdin.end();
  await Promise.allSettled(collectors.map(({ exited }) => exited));
  await rm(root, { recursive: true, force: true });
}
