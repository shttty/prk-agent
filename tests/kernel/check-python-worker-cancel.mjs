import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout } from "node:timers/promises";
import { buildForkserver } from "../../src/kernel/forkserver/build-forkserver.ts";
import { DEFAULT_KERNEL_RUNTIME_OPTIONS } from "../../src/kernel/kernel-options.ts";
import { readPythonSource } from "../../src/target-channel/deployment-source/read-python-source.ts";

const python = process.env.PI_TEST_PYTHON;
assert(python && isAbsolute(python), "PI_TEST_PYTHON must name the absolute owned test interpreter");
const home = await mkdtemp(join(tmpdir(), "prk-worker-stop-"));
const generation = crypto.randomUUID();
const processWindow = { maxRequests: 8, maxBytes: 2 ** 21, maxFrameBytes: 2 ** 20 };
const bootstrap = readFileSync(new URL("../../src/kernel/process/bootstrap.py", import.meta.url), "utf8");
const child = spawn(python, ["-I", "-u", "-c", bootstrap, String(processWindow.maxFrameBytes)], {
  cwd: home, env: { ...process.env, HOME: home, PRK_HOME: home, TMPDIR: home },
  stdio: ["pipe", "pipe", "pipe"],
});
const closed = once(child, "close");
const frames = [];
let diagnostics = "", requestId = 0;
child.stderr.setEncoding("utf8").on("data", (text) => { diagnostics += text; });
createInterface({ input: child.stdout }).on("line", (line) => frames.push(JSON.parse(line)));
const send = (frame) => child.stdin.write(`${JSON.stringify(frame)}\n`);
const command = (cellId, kind, fields) => {
  const id = ++requestId;
  send({ generation, cellId, id, kind, ...fields });
  return id;
};
const execute = (cellId, code) => command(cellId, "execute", { code, title: cellId, defaultCellMode: "thread" });
const find = (cellId, kind) => frames.find((frame) => frame.cellId === cellId && frame.kind === kind);
const stream = (cellId) => frames.filter((frame) => frame.cellId === cellId && frame.kind === "stream").map(({ text }) => text).join("");
const wait = async (pick, label) => {
  const deadline = performance.now() + 5000;
  for (;;) {
    assert(!frames.some(({ kind }) => kind === "fatal"), JSON.stringify(frames));
    const frame = pick();
    if (frame) return frame;
    assert(child.exitCode === null && performance.now() < deadline, `${label}\n${JSON.stringify(frames)}\n${diagnostics}`);
    await setTimeout(5);
  }
};
const entered = (cellId, marker) => wait(() => stream(cellId).includes(marker), marker);
const cancel = async (cellId) => {
  const id = command(cellId, "cancel");
  await wait(() => frames.find(({ kind, re }) => kind === "ack" && re === id), `cancel ack for ${cellId}`);
};
const ended = async (cellId, re, outcome) => {
  const end = await wait(() => find(cellId, "cell_end"), `actual exit of ${cellId}`);
  assert.deepEqual(end, { generation, cellId, kind: "cell_end", re, outcome });
};

try {
  send({ source: readPythonSource(new URL("../../src/kernel/runner/", import.meta.url)),
    launcher: readFileSync(new URL("../../src/kernel/process/launch-python.py", import.meta.url), "utf8"),
    forkserverSource: buildForkserver(),
    configuration: { generation, maxActiveCells: 2, forkserverPreload: [], processWindow,
      options: DEFAULT_KERNEL_RUNTIME_OPTIONS, scope: { enabled: false } } });
  const ready = await wait(() => find(null, "ready"), "real Python runner ready");
  const loop = execute("loop", `import os, threading
loop_worker = threading.current_thread()
retained = 42
try:
 print('LOOP_ENTER')
 while True:
  pass
finally:
 print('LOOP_FINALLY')`);
  await entered("loop", "LOOP_ENTER\n");
  await cancel("loop");
  await ended("loop", loop, "aborted");
  assert.match(stream("loop"), /LOOP_FINALLY\n/);

  const blocked = execute("blocked", `blocked_worker = threading.current_thread()
read_fd, write_fd = os.pipe()
try:
 print('READ_ENTER')
 os.read(read_fd, 1)
 retained = -1
finally:
 os.close(read_fd)
 print('READ_FINALLY')`);
  await entered("blocked", "READ_ENTER\n");
  await cancel("blocked");
  const stopping = await wait(() => find("blocked", "cell_state"), "C-blocked worker published evidence");
  assert.equal(stopping.state, "stopping");
  assert.deepEqual(stopping.blockedAt.map(({ step, status }) => [step, status]),
    [["inject", "queued"], ["syscall", "observed"], ["socket", "skipped"]]);
  assert.match(stopping.blockedAt[1].evidence, /\bread\b/);
  assert.match(stopping.blockedAt[2].evidence, /no verifiable socket identity/);
  assert(stopping.blockedAt.every(({ observedAt }) => Number.isSafeInteger(observedAt)));
  await cancel("blocked");
  assert.equal(frames.filter(({ cellId, kind }) => cellId === "blocked" && kind === "cell_state").length, 1);
  assert.equal(find("blocked", "cell_end"), undefined, "queued exception and repeated ack are not exit evidence");
  assert.doesNotMatch(stream("blocked"), /READ_FINALLY/);

  const release = execute("release", "assert not loop_worker.is_alive()\nos.write(write_fd, b'x')\nos.close(write_fd)");
  await ended("release", release, "ok");
  await ended("blocked", blocked, "aborted");
  assert.match(stream("blocked"), /READ_FINALLY\n/);

  const fresh = execute("fresh", `assert not blocked_worker.is_alive()
fresh_worker = threading.current_thread()
assert fresh_worker is not blocked_worker
fresh_read, fresh_write = os.pipe()
print('FRESH_ENTER')
os.read(fresh_read, 1)
os.close(fresh_read)
print('FRESH_RETAINED', retained)`);
  await entered("fresh", "FRESH_ENTER\n");
  await cancel("blocked");
  await cancel("loop");
  assert.equal(find("fresh", "cell_end"), undefined, "expired identities cannot hit the new worker");
  assert.equal(find("fresh", "cell_state"), undefined);
  const finish = execute("finish", "os.write(fresh_write, b'x')\nos.close(fresh_write)");
  await ended("finish", finish, "ok");
  await ended("fresh", fresh, "ok");
  assert.match(stream("fresh"), /FRESH_RETAINED 42\n/);

  const timer = execute("timer", "import time\nprint('TIMER_ENTER')\ntime.sleep(2)\nretained = -2");
  await entered("timer", "TIMER_ENTER\n");
  await cancel("timer");
  const sample = find("timer", "cell_state");
  assert.deepEqual(sample?.blockedAt.map(({ step, status }) => [step, status]),
    [["inject", "queued"], ["syscall", "observed"], ["parameters", "observed"], ["timer", "bounded"]]);
  assert.match(sample.blockedAt[1].evidence, /^(clock_nanosleep|nanosleep|pselect6)$/);
  for (const step of sample.blockedAt.slice(0, 3)) assert.deepEqual(Object.keys(step).sort(), ["evidence", "observedAt", "status", "step"]);
  assert(Number.isSafeInteger(sample.blockedAt[3].remainingMs) && sample.blockedAt[3].remainingMs >= 0);
  assert.equal(find("timer", "cell_end"), undefined);
  await ended("timer", timer, "aborted");

  const privateWait = command("await", "execute", { defaultCellMode: "thread", mode: "thread", title: "Private await", code: `import asyncio
try:
 print('AWAIT_ENTER')
 await asyncio.Event().wait()
finally:
 print('AWAIT_FINALLY')` });
  await entered("await", "AWAIT_ENTER\n");
  await cancel("await");
  assert.deepEqual(find("await", "cell_state")?.blockedAt.map(({ step, status }) => [step, status]), [["task", "queued"]]);
  await ended("await", privateWait, "aborted");
  assert.match(stream("await"), /AWAIT_FINALLY\n/);
  for (const cellId of ["loop", "blocked", "release", "fresh", "finish", "timer", "await"])
    assert.equal(frames.filter((frame) => frame.cellId === cellId && frame.kind === "cell_end").length, 1);
  console.log(`PASS CPython ${ready.version}: loop exit, C-read stopping, duplicate/stale isolation and retained namespace, bounded timer sample, private Task exit`);
} finally {
  child.stdin.end();
  const timeout = new AbortController();
  const watchdog = setTimeout(2000, false, { signal: timeout.signal });
  try {
    if (!await Promise.race([closed.then(() => true), watchdog])) {
      child.kill("SIGKILL");
      await closed;
    }
  } finally { timeout.abort(); }
  await rm(home, { recursive: true, force: true });
}
