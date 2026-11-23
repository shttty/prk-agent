import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { buildForkserver } from "../../src/kernel/forkserver/build-forkserver.ts";
import { DEFAULT_KERNEL_RUNTIME_OPTIONS } from "../../src/kernel/kernel-options.ts";
import { readPythonSource } from "../../src/target-channel/deployment-source/read-python-source.ts";

if (process.platform !== "linux" || process.arch !== "x64") {
  console.log("SKIP: Python socket-stop observation requires Linux x86_64");
  process.exit(0);
}
const python = process.env.PI_TEST_PYTHON;
assert(python && isAbsolute(python), "PI_TEST_PYTHON must name the absolute owned test interpreter");
const home = await mkdtemp(join(tmpdir(), "prk-sock-"));
const generation = crypto.randomUUID();
const processWindow = { maxRequests: 8, maxBytes: 2 ** 21, maxFrameBytes: 2 ** 20 };
const bootstrap = readFileSync(new URL("../../src/kernel/process/bootstrap.py", import.meta.url), "utf8");
const fixture = readFileSync(new URL("./fixtures/socket-wait-lifetime.py", import.meta.url), "utf8");
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
function command(cellId, kind, fields) {
  const id = ++requestId;
  send({ generation, cellId, id, kind, ...fields });
  return id;
}
const execute = (cellId, code) => command(cellId, "execute", { code, title: cellId, defaultCellMode: "thread" });
const find = (cellId, kind) => frames.find((frame) => frame.cellId === cellId && frame.kind === kind);
async function until(pick, label) {
  const deadline = performance.now() + 5000;
  for (;;) {
    const failure = frames.find(({ kind }) => kind === "fatal");
    assert(!failure, JSON.stringify(failure));
    const frame = pick();
    if (frame) return frame;
    assert(child.exitCode === null && performance.now() < deadline, `${label}\n${JSON.stringify(frames.slice(-12))}\n${diagnostics}`);
    await delay(5);
  }
}
async function ended(cellId, re, outcome) {
  const result = await until(() => find(cellId, "cell_end"), `actual exit of ${cellId}`);
  assert.deepEqual(result, { generation, cellId, kind: "cell_end", re, outcome }, JSON.stringify(find(cellId, "error")));
}
async function run(cellId, code) { await ended(cellId, execute(cellId, code), "ok"); }

try {
  send({
    source: `${readPythonSource(new URL("../../src/kernel/runner/", import.meta.url))}\n\n${fixture}`,
    launcher: readFileSync(new URL("../../src/kernel/process/launch-python.py", import.meta.url), "utf8"),
    forkserverSource: buildForkserver(),
    configuration: { generation, maxActiveCells: 2, forkserverPreload: [], processWindow,
      options: DEFAULT_KERNEL_RUNTIME_OPTIONS, scope: { enabled: false } },
  });
  const ready = await until(() => find(null, "ready"), "Python runner ready");
  const cases = [
    ["recv", "none", "applied", /recvfrom: Unix stream/],
    ["recv", "after_first_identity", "skipped", /Pinned descriptor does not match the first socket identity/],
    ["recv", "after_dup", "skipped", /Current descriptor no longer matches the first socket identity/],
    ["recv", "after_check", "applied", /recvfrom: Unix stream/],
    ["read", "none", "applied", /read: Unix stream/],
    ["poll", "none", "applied", /p?poll: Unix stream/],
    ["select", "none", "applied", /(?:pselect6|select): Unix stream/],
    ["ambiguous", "none", "skipped", /does not identify a single descriptor/],
    ["datagram", "none", "skipped", /not a stream socket/],
  ];
  for (const [index, [wait, phase, status, evidence]] of cases.entries()) {
    const id = `socket-${index}`;
    const request = execute(id, `from _prk_test_socket_wait import _SocketTrial
import socket
trial = _SocketTrial(${JSON.stringify(wait)}, ${JSON.stringify(phase)})
try:
 trial.block()
finally:
 print('WAIT_EXIT')`);
    await until(() => find(id, "cell_admitted"), `${id} admitted`);
    await run(`${id}-observe`, `import time
for _ in range(3000):
 if 'trial' in globals():
  break
 time.sleep(.001)
trial.await_syscall()
socket.setdefaulttimeout(0)`); // A borrowed socket wrapper must not change O_NONBLOCK.
    const cancelId = command(id, "cancel");
    const stopping = await until(() => find(id, "cell_state"), `stop diagnostic for ${id}`);
    assert.equal(stopping.state, "stopping");
    const decision = stopping.blockedAt.find(({ step }) => step === "socket");
    assert.equal(decision?.status, status, JSON.stringify(stopping));
    assert.match(decision.evidence, evidence);
    assert.equal(decision.action, status === "applied" ? "shutdown(SHUT_RDWR) on pinned duplicate" : undefined);
    await until(() => frames.find(({ kind, re }) => kind === "ack" && re === cancelId), `cancel ack for ${id}`);
    if (status === "applied") await ended(id, request, "aborted");
    else assert.equal(find(id, "cell_end"), undefined, "rejection must leave the original worker blocked");
    await run(`${id}-verify`, `socket.setdefaulttimeout(None)
trial.verify(${status === "applied" ? "True" : "False"})`);
    await ended(id, request, "aborted");
    assert.match(find(id, "stream")?.text, /WAIT_EXIT/);
    await run(`${id}-cleanup`, "trial.close()\ndel trial");
  }
  console.log(`PASS CPython ${ready.version}: real socket waits, three fd reuse boundaries, rejection reasons, replacement roundtrips and shared EOF`);
} finally {
  child.stdin.end();
  const timeout = new AbortController();
  try {
    if (!await Promise.race([closed.then(() => true), delay(2000, false, { signal: timeout.signal })])) {
      child.kill("SIGKILL");
      await closed;
    }
  } finally { timeout.abort(); }
  await rm(home, { recursive: true, force: true });
}
