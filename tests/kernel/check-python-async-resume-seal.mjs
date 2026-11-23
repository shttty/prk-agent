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
  console.log("SKIP: real stale-resume syscall witness requires Linux x86_64");
  process.exit(0);
}
const python = process.env.PI_TEST_PYTHON;
assert(python && isAbsolute(python), "PI_TEST_PYTHON must name the absolute fixture interpreter");
const root = new URL("../../src/kernel/", import.meta.url);
const load = (name) => readFileSync(new URL(name, root), "utf8");
const fixture = readFileSync(new URL("./fixtures/async-resume-witness.py", import.meta.url), "utf8");
const home = await mkdtemp(join(tmpdir(), "prk-seal-"));
const generation = crypto.randomUUID();
const processWindow = { maxRequests: 8, maxBytes: 2 ** 21, maxFrameBytes: 2 ** 20 };
const child = spawn(python, ["-I", "-u", "-c", load("process/bootstrap.py"), String(processWindow.maxFrameBytes)], {
  cwd: home, env: { ...process.env, HOME: home, PRK_HOME: home, TMPDIR: home },
  stdio: ["pipe", "pipe", "pipe"],
});
const closed = once(child, "close");
const frames = [];
let stderr = "", id = 0;
child.stderr.setEncoding("utf8").on("data", (text) => { stderr += text; });
createInterface({ input: child.stdout }).on("line", (line) => frames.push(JSON.parse(line)));
const send = (frame) => child.stdin.write(`${JSON.stringify(frame)}\n`);
const execute = (cellId, code, mode) => {
  const re = ++id;
  send({ generation, kind: "execute", id: re, cellId, code, title: cellId, defaultCellMode: "thread", mode });
  return re;
};
async function receive(kind, cellId) {
  const deadline = performance.now() + 5000;
  while (true) {
    const found = frames.find((frame) => frame.kind === kind && frame.cellId === cellId);
    if (found) return found;
    assert(child.exitCode === null && child.signalCode === null && performance.now() < deadline,
      `${cellId} ${kind}: ${stderr}\n${JSON.stringify(frames.slice(-12))}`);
    await delay(5);
  }
}
async function ended(cellId, re) {
  const terminal = await receive("cell_end", cellId);
  assert.deepEqual(terminal, { generation, cellId, kind: "cell_end", re, outcome: "ok" },
    JSON.stringify(frames.find((frame) => frame.cellId === cellId && frame.kind === "error")));
}

try {
  send({
    source: `${readPythonSource(new URL("runner/", root))}\n\n${fixture}`,
    launcher: load("process/launch-python.py"), forkserverSource: buildForkserver(),
    configuration: { generation, maxActiveCells: 2, forkserverPreload: [], processWindow,
      options: DEFAULT_KERNEL_RUNTIME_OPTIONS, scope: { enabled: false } },
  });
  const { version } = await receive("ready", null);
  await ended("setup", execute("setup", `from _prk_async_resume_witness import hold, reject_old, open_trial
witness = open_trial()`, "thread"));
  const waiting = execute("resumed", "await hold(witness)", "async");
  await receive("cell_admitted", "resumed");
  await ended("compare", execute("compare", "reject_old(witness)", "thread"));
  await ended("resumed", waiting);
  await ended("C", execute("C", "assert 6 * 7 == 42", "async"));
  console.log(`PASS CPython ${version}: previous resume token rejected at real recvfrom; same Task/socket and next Task complete`);
  child.stdin.end();
  assert.deepEqual(await Promise.race([closed, delay(2000, "runner did not drain", { ref: false })]), [0, null]);
} finally {
  child.stdin.end();
  if (!await Promise.race([closed.then(() => true), delay(2000, false, { ref: false })])) {
    child.kill("SIGKILL");
    await closed;
  }
  await rm(home, { recursive: true, force: true });
}
