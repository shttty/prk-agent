import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { buildForkserver } from "../../src/kernel/forkserver/build-forkserver.ts";
import { DEFAULT_KERNEL_RUNTIME_OPTIONS } from "../../src/kernel/kernel-options.ts";
import { readPythonSource } from "../../src/target-channel/deployment-source/read-python-source.ts";

if (process.platform !== "linux" || process.arch !== "x64") {
  console.log("SKIP: Python child-stop observation requires Linux x86_64");
  process.exit(0);
}
const python = process.env.PI_TEST_PYTHON;
assert(python && isAbsolute(python), "PI_TEST_PYTHON must name the absolute owned test interpreter");
const bootstrap = readFileSync(new URL("../../src/kernel/process/bootstrap.py", import.meta.url), "utf8");
const fixture = readFileSync(new URL("./fixtures/child-wait-lifetime.py", import.meta.url), "utf8");
const fixtureChild = readFileSync(new URL("./fixtures/child-wait-process.py", import.meta.url), "utf8");
const home = await mkdtemp(join("/tmp", "prk-child-"));
const generation = crypto.randomUUID();
const processWindow = { maxRequests: 8, maxBytes: 2 ** 21, maxFrameBytes: 2 ** 20 };
const child = spawn(python, ["-I", "-u", "-c", bootstrap, String(processWindow.maxFrameBytes)], {
  cwd: home, env: { ...process.env, HOME: home, PRK_HOME: home, TMPDIR: home },
  stdio: ["pipe", "pipe", "pipe"], detached: true, // The runner's PGID must not include the test controller.
});
const closed = once(child, "close");
const frames = [];
const pending = new Set();
let diagnostics = "", requestId = 0;
child.stderr.setEncoding("utf8").on("data", (text) => { diagnostics += text; });
createInterface({ input: child.stdout }).on("line", (line) => {
  const frame = JSON.parse(line);
  frames.push(frame);
  if (frame.kind === "cell_end") pending.delete(frame.cellId);
});
const send = (frame) => child.stdin.write(`${JSON.stringify(frame)}\n`);
const find = (cellId, kind) => frames.find((frame) => frame.cellId === cellId && frame.kind === kind);
function command(cellId, kind, fields) {
  const id = ++requestId;
  send({ generation, cellId, id, kind, ...fields });
  return id;
}
function execute(cellId, code) {
  pending.add(cellId);
  return command(cellId, "execute", { code, title: cellId, defaultCellMode: "thread" });
}
async function until(pick, label) {
  const deadline = performance.now() + 5000;
  for (;;) {
    const frame = pick();
    if (frame) return frame;
    const failure = find(null, "fatal");
    assert(!failure, JSON.stringify(failure));
    assert(child.exitCode === null && child.signalCode === null && performance.now() < deadline,
      `${label}\n${JSON.stringify(frames.slice(-12))}\n${diagnostics}`);
    await delay(5);
  }
}
async function ended(cellId, re, outcome) {
  const result = await until(() => find(cellId, "cell_end"), `actual exit of ${cellId}`);
  assert.deepEqual(result, { generation, cellId, kind: "cell_end", re, outcome }, JSON.stringify(find(cellId, "error")));
}
async function run(cellId, code) { await ended(cellId, execute(cellId, code), "ok"); }
async function acknowledged(cellId, request) {
  await until(() => frames.find(({ cellId: id, kind, re }) => id === cellId && kind === "ack" && re === request),
    `cancel ack for ${cellId}`);
}
async function closeProcess(process, closed) {
  process.stdin.end();
  const timeout = new AbortController();
  try {
    const result = await Promise.race([closed, delay(2000, null, { signal: timeout.signal })]);
    if (result) return result;
    process.kill("SIGKILL");
    return await closed;
  } finally { timeout.abort(); }
}
async function rejectExternalTarget() {
  // An independently owned process/group outside the runner, released by EOF, not cancellation.
  const external = spawn(python, ["-I", "-u", "-c", "import sys; sys.stdin.buffer.read()"], {
    cwd: home, env: { ...process.env, HOME: home, PRK_HOME: home, TMPDIR: home },
    stdio: ["pipe", "ignore", "ignore"], detached: true,
  });
  const exited = once(external, "close");
  try {
    await once(external, "spawn");
    const id = command("external-target", "cancel", { pid: external.pid, pgid: external.pid });
    await until(() => find(null, "fatal"), "runner rejects foreign PID/PGID on the cancel wire");
    assert(!frames.some(({ kind, re }) => kind === "ack" && re === id), "invalid cancel was accepted");
  } finally {
    assert.deepEqual(await closeProcess(external, exited), [0, null], "external process must exit normally after our EOF");
  }
}

try {
  send({
    source: `${readPythonSource(new URL("../../src/kernel/runner/", import.meta.url))}\n\n_CHILD_CODE = ${JSON.stringify(fixtureChild)}\n${fixture}`,
    launcher: readFileSync(new URL("../../src/kernel/process/launch-python.py", import.meta.url), "utf8"),
    forkserverSource: buildForkserver(),
    configuration: { generation, maxActiveCells: 3, forkserverPreload: [], processWindow,
      options: DEFAULT_KERNEL_RUNTIME_OPTIONS, scope: { enabled: false } },
  });
  const ready = await until(() => find(null, "ready"), "Python runner ready");
  await run("normal", `from _prk_test_child_wait import ChildTrial
import subprocess, sys
argv = [sys.executable, '-I', '-c', "import sys; print('out'); print('err', file=sys.stderr)"]
result = subprocess.run(argv, capture_output=True, timeout=3, check=True)
assert (result.stdout, result.stderr) == (b'out\\n', b'err\\n')
with subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE) as normal_child:
 assert normal_child.communicate(timeout=3) == (b'out\\n', b'err\\n')
 assert normal_child.wait(timeout=3) == 0`);
  const cases = [
    ["run", true], ["retained-wait", true], ["group-leader", true], ["group-member", true], ["capture", true],
    ["shared-communicate", true], ["pipe-read", true], ["waitid-pid", true],
    ["multiwriter", false], ["multipipe", false], ["wait-any", false], ["wait-group", false],
  ];
  if (Number(ready.version.split(".")[1]) >= 11) cases.push(["waitid-pidfd", true]); // Python exposes P_PIDFD from 3.11.
  for (const [id, applied] of cases) {
    // Setup finishes before the waiter starts: retained Popen handles cross cell/thread boundaries.
    await run(`${id}-setup`, `trial = ChildTrial(${JSON.stringify(id)})\ntrial.setup()`);
    const request = execute(id, `try:
 trial.block('owner')
finally:
 print('WAIT_EXIT')`);
    await until(() => find(id, "cell_admitted"), `${id} admitted`);
    const shared = id === "shared-communicate";
    const peer = `${id}-peer`;
    const peerRequest = shared ? execute(peer, "trial.block('peer')") : undefined;
    await run(`${id}-observe`, `trial.observe('owner')${shared ? "\ntrial.observe('peer')" : ""}`);
    if (id === "pipe-read") {
      const previous = "retained-wait";
      const states = frames.filter(({ cellId, kind }) => cellId === previous && kind === "cell_state").length;
      await acknowledged(previous, command(previous, "cancel"));
      assert.equal(frames.filter(({ cellId, kind }) => cellId === previous && kind === "cell_state").length, states,
        "a cancel for a finished cell must not start another stop");
      assert.equal(find(id, "cell_end"), undefined, "late cancel must not stop the current waiter");
      await run(`${id}-after-stale`, "trial.observe('owner')");
    }
    const cancelId = command(id, "cancel");
    const stopping = await until(() => find(id, "cell_state"), `stop diagnostic for ${id}`);
    assert.equal(stopping.state, "stopping");
    const decision = stopping.blockedAt.find(({ step }) => step === "child");
    assert((applied ? ["applied"] : ["skipped", "unavailable"]).includes(decision?.status), JSON.stringify(stopping));
    await acknowledged(id, cancelId);
    if (!applied) {
      assert.equal(find(id, "cell_end"), undefined, "rejection must leave the original worker blocked");
      await run(`${id}-release`, "trial.reject_and_release()");
    } else if (id === "pipe-read") {
      // A healthy peer can still execute while the signalled child is an unreaped zombie.
      await until(() => find(id, "error"), "cancelled worker has unwound its user code before reap");
      await run(`${id}-unreaped`, "trial.observe_unreaped()");
      assert.equal(find(id, "cell_end"), undefined, "exit-ready is not reaped");
      await run(`${id}-allow-reap`, "trial.allow_reap()");
    }
    await ended(id, request, "aborted");
    const output = frames.filter(({ cellId, kind }) => cellId === id && kind === "stream").map(({ text }) => text).join("");
    assert.match(output, /WAIT_EXIT/);
    if (shared) {
      await ended(peer, peerRequest, "ok");
      assert.equal(find(peer, "cell_state"), undefined, "the peer gets a child exit status, not cancellation");
    }
    await run(`${id}-verify`, "trial.verify()\ntrial.close()");
  }
  await rejectExternalTarget(); // Intentionally invalid wire frame; this must be the final runner request.
  console.log(`PASS CPython ${ready.version}: directed child waits and pipes, groups, shared waiters, delayed reap and no-signal cases`);
} finally {
  try {
    // On the intentional red run the child is still alive and the original waiter still blocked.
    // Release the owned children, drain those waiters, then reap any remaining children individually.
    await writeFile(join(home, "release-all"), "");
    if (find(null, "ready") && !find(null, "fatal") && child.exitCode === null && child.signalCode === null) {
      if (pending.has("pipe-read")) await run("fixture-reap", "trial.allow_reap()");
      await until(() => pending.size === 0, `drain pending cells: ${[...pending].join(", ")}`);
      await run("fixture-finally", "from _prk_test_child_wait import cleanup_child_trials\ncleanup_child_trials()");
    }
  } finally {
    try { await closeProcess(child, closed); }
    finally { await rm(home, { recursive: true, force: true }); }
  }
}
