import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout } from "node:timers/promises";
import { buildForkserver } from "../../src/kernel/forkserver/build-forkserver.ts";
import { DEFAULT_KERNEL_RUNTIME_OPTIONS } from "../../src/kernel/kernel-options.ts";
import { readPythonSource } from "../../src/target-channel/deployment-source/read-python-source.ts";

const python = process.env.PI_TEST_PYTHON;
assert(python && isAbsolute(python), "PI_TEST_PYTHON must name the absolute owned test interpreter");
const home = await mkdtemp(join(tmpdir(), "prk-fs-"));
const kernel = new URL("../../src/kernel/", import.meta.url);
const bootstrap = readFileSync(new URL("process/bootstrap.py", kernel), "utf8");
const launcher = readFileSync(new URL("process/launch-python.py", kernel), "utf8");
const runner = readPythonSource(new URL("runner/", kernel));
const service = buildForkserver();
const processWindow = { maxRequests: 8, maxBytes: 2 ** 21, maxFrameBytes: 2 ** 20 };

function procStatus(pid) {
  return Object.fromEntries(readFileSync(`/proc/${pid}/status`, "utf8").split("\n")
    .filter((line) => line.includes(":"))
    .map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1).trim()]));
}

async function check(preload, failImport) {
  const generation = crypto.randomUUID();
  // Invoke the bootstrap-owned private socket from the runner seam, not a new kernel command.
  const source = runner + `
from array import array as FixtureArray
from contextlib import ExitStack as FixtureExitStack
import json as fixture_json
import socket as fixture_socket
import sys as fixture_sys
import time as fixture_time
from pathlib import Path as FixturePath
import threading as fixture_threading
fixture_run_kernel = run_kernel
def run_kernel(configuration):
    assert not any(name in fixture_sys.modules for name in configuration["forkserverPreload"])
    def exercise_forkserver():
        with FixtureExitStack() as held:
            for cell in ("fixture-1", "fixture-2"):
                while not FixturePath("request-" + cell).exists():
                    fixture_time.sleep(.005)
                status, send_status = fixture_socket.socketpair(fixture_socket.AF_UNIX, fixture_socket.SOCK_SEQPACKET)
                held.enter_context(status)
                with send_status:
                    data, send_data = fixture_socket.socketpair(fixture_socket.AF_UNIX, fixture_socket.SOCK_STREAM)
                    held.enter_context(data)
                    with send_data:
                        request = fixture_json.dumps({"kind": "fork", "generation": configuration["generation"], "cellId": cell}).encode()
                        rights = FixtureArray("i", [send_status.fileno(), send_data.fileno()])
                        assert forkserver.sendmsg([request], [(fixture_socket.SOL_SOCKET, fixture_socket.SCM_RIGHTS, rights)]) == len(request)
                raw = status.recv(65536)
                rejected = fixture_json.loads(raw)["kind"] == "rejected"
                if rejected:
                    assert status.recv(1) == b"" and data.recv(1) == b""
                    status.close()
                    data.close()
                print("FORKSERVER_REPLY " + raw.decode(), file=fixture_sys.__stderr__, flush=True)
                if cell == "fixture-1" and rejected:
                    return
            # Keep the first worker waiting for preparation until bootstrap shuts down the service.
            fixture_threading.Event().wait()
    fixture_threading.Thread(target=exercise_forkserver, daemon=True).start()
    fixture_run_kernel(configuration)
`;
  const child = spawn(python, ["-u", "-c", bootstrap, String(processWindow.maxFrameBytes)], {
    cwd: home, env: { ...process.env, HOME: home, PRK_HOME: home, TMPDIR: home, PYTHONPATH: home,
      OPENBLAS_NUM_THREADS: "19", OMP_NUM_THREADS: "19", MKL_NUM_THREADS: "19", BLIS_NUM_THREADS: "19" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const closed = once(child, "close");
  const frames = [], replies = [];
  let diagnostics = "", replyTail = "";
  createInterface({ input: child.stdout }).on("line", (line) => {
    const frame = JSON.parse(line);
    frames.push(frame);
    if (frame.kind !== "diagnostic" || frame.stream !== "stderr") return;
    const lines = (replyTail + frame.text).split("\n");
    replyTail = lines.pop();
    const prefix = "FORKSERVER_REPLY ";
    for (const diagnostic of lines) {
      if (diagnostic.startsWith(prefix)) replies.push(JSON.parse(diagnostic.slice(prefix.length)));
    }
  });
  child.stderr.setEncoding("utf8").on("data", (text) => { diagnostics += text; });
  const send = (frame) => child.stdin.write(JSON.stringify(frame) + "\n");
  const wait = async (pick, label) => {
    const deadline = performance.now() + 4000;
    for (;;) {
      const result = pick();
      if (result) return result;
      assert(child.exitCode === null && performance.now() < deadline, `${label}: ${JSON.stringify(frames)}\n${diagnostics}`);
      await setTimeout(5);
    }
  };
  const run = async (id, code) => {
    const cellId = `thread-${id}`;
    send({ kind: "execute", generation, cellId, id, code, title: cellId, defaultCellMode: "thread" });
    await wait(() => frames.find((frame) => frame.kind === "cell_admitted" && frame.cellId === cellId && frame.mode === "thread"), "thread admitted");
    const end = await wait(() => frames.find((frame) => frame.kind === "cell_end" && frame.cellId === cellId), "thread ended");
    assert.equal(end.outcome, "ok", JSON.stringify(frames));
  };
  try {
    send({ source, launcher, forkserverSource: service, configuration: {
      generation, maxActiveCells: 2, forkserverPreload: preload, processWindow,
      options: DEFAULT_KERNEL_RUNTIME_OPTIONS, scope: { enabled: false },
    } });
    const ready = await wait(() => frames.find(({ kind }) => kind === "ready"), "runner ready");
    await run(1, "import os\nassert os.environ['OPENBLAS_NUM_THREADS'] == '19'\nretained = 42");
    await writeFile(join(home, "request-fixture-1"), "");
    const first = await wait(() => replies[0], "first fork reply");
    assert.equal(first.generation, generation);
    assert.equal(first.cellId, "fixture-1");
    if (failImport) {
      assert.equal(first.kind, "rejected");
      assert.equal(first.code, "ISOLATION_UNAVAILABLE");
      assert.equal(first.preload, "prk_bad_preload");
      assert.match(first.reason, /prk_bad_preload.*fixture import failure/);
    } else {
      assert.equal(first.kind, "forked");
      assert.equal(first.threads, 1);
      assert.equal(first.pid, first.pgid);
      const worker = procStatus(first.pid);
      const parent = procStatus(Number(worker.PPid));
      assert.equal(parent.PPid, String(ready.pid), "only the independent forkserver forks");
      assert.equal(worker.NSpgid, String(first.pid));
      assert.equal(worker.NSsid, String(first.pid));
      process.kill(Number(worker.PPid), "SIGINT");
      await writeFile(join(home, "request-fixture-2"), "");
      const second = await wait(() => replies[1], "second fork reply");
      assert.deepEqual(second, { kind: "rejected", generation, cellId: "fixture-2", code: "ISOLATION_UNAVAILABLE",
        reason: "forkserver must have exactly one OS thread", threads: 2, preload: null });
      assert.equal(parent.Threads, "2", "preloaded hook started a real OS thread");
      assert.equal(readFileSync(`/proc/${worker.PPid}/task/${worker.PPid}/children`, "utf8").trim(), String(first.pid), "refusal creates no second child");
    }
    await run(2, "assert retained == 42");
    if (!failImport) assert.doesNotMatch(procStatus(first.pid).State, /^[ZX]\b/, "first child is still alive without preparation");
    const serverPids = readFileSync(`/proc/${ready.pid}/task/${ready.pid}/children`, "utf8").trim().split(/\s+/).filter(Boolean);
    assert.equal(serverPids.length, 1);
    child.stdin.end();
    const deadline = new AbortController();
    let status;
    try {
      status = await Promise.race([closed, setTimeout(1500, null, { signal: deadline.signal })]);
    } finally { deadline.abort(); }
    assert(status, `runner did not reap before close deadline\n${diagnostics}`);
    const [code, signal] = status;
    assert.deepEqual([code, signal], [0, null], diagnostics);
    for (const pid of [...serverPids, ...(failImport ? [] : [first.pid])]) {
      assert(!existsSync(`/proc/${pid}`), `owned process ${pid} must be reaped, not a zombie`);
    }
    return ready.version;
  } finally {
    child.stdin.end();
    const deadline = new AbortController();
    try {
      if (!await Promise.race([closed.then(() => true), setTimeout(1500, false, { signal: deadline.signal })])) {
        child.kill("SIGKILL");
        await closed;
      }
    } finally { deadline.abort(); }
  }
}

try {
  await writeFile(join(home, "prk_first_preload.py"), `import os
assert all(os.environ[k] == "1" for k in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS", "BLIS_NUM_THREADS"))
`);
  await writeFile(join(home, "prk_guard_preload.py"), `import sys, os, threading
assert "prk_first_preload" in sys.modules
park = threading.Event()
def start_thread_after_first_fork():
    threading.Thread(target=park.wait).start()
os.register_at_fork(after_in_parent=start_thread_after_first_fork)
`);
  await writeFile(join(home, "prk_bad_preload.py"), "raise RuntimeError('fixture import failure')\n");
  const version = await check(["prk_first_preload", "prk_guard_preload"], false);
  for (const id of [1, 2]) await rm(join(home, `request-fixture-${id}`));
  await check(["prk_bad_preload"], true);
  console.log(`PASS CPython ${version}: exec preload, Threads=1 -> 2, owned group/reap, preload failure and retained thread namespace`);
} finally { await rm(home, { recursive: true, force: true }); }
