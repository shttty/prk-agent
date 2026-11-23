import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { constants, createReadStream } from "node:fs";
import { lstat, open, readdir, readFile, readlink, realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ArtifactStore } from "../../../src/artifacts/store/assemble-store.ts";
import { DEFAULT_CODEMODE_OPTIONS } from "../../../src/config/codemode/codemode-options.ts";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { prepareTransfer } from "../../../src/remote-extensions/deployment/prepare-transfer.ts";
import { readArtifact } from "../../../src/remote-extensions/deployment/read-artifact.ts";
import { transferArtifact } from "../../../src/remote-extensions/deployment/transfer-artifact.ts";
import { createTargetChannels } from "../../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../../src/target-channel/process-transport/open.ts";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";
import { findFixtureExecutable } from "../../fixtures/native-tool-artifacts.mjs";
import { createOwnedEnvironment } from "../../fixtures/target-environment/create-owned-environment.mjs";

const memoryMax = "512M";
const memorySwapMax = "0";
const scopeProperties = ["-p", `MemoryMax=${memoryMax}`, "-p", `MemorySwapMax=${memorySwapMax}`];
const subprocess = { encoding: "utf8", timeout: 5000, killSignal: "SIGKILL", maxBuffer: 64 * 1024 };
const closeOnExec = 0o2000000; // Linux O_CLOEXEC as shown by /proc/PID/fdinfo.

export async function checkBunStdinIsolation() {
  assert(process.platform === "linux" && process.arch === "x64", "bun-local requires Linux x86_64 and procfs");
  const python = process.env.PI_TEST_PYTHON;
  assert(python && isAbsolute(python), "bun-local requires an absolute PI_TEST_PYTHON path");
  const bun = await findFixtureExecutable("bun", process.env.PI_TEST_BUN_BINARY);
  const fixture = await createOwnedEnvironment({ prefix: "prk-bsi-" });
  try {
    const cwd = await realpath(fixture.root);
    const cacheRoot = join(cwd, "target-cache");
    const store = new ArtifactStore(join(cwd, "prk", "assets"));
    const processWindow = parseProcessWindowLimits();
    const acquire = () => fixture.acquire("local");
    const environment = await acquire();
    const daemonPid = fixture.events.find(({ kind, id, local }) => kind === "spawn" && id === "local" && local === true)?.loginPid;
    assert(Number.isSafeInteger(daemonPid) && daemonPid > 1, "expected the owned local daemon PID");
    const startTimeoutMs = 10000;
    const channels = createTargetChannels({ options: { startTimeoutMs, processWindow }, open: async (_, signal, limits) => ({
      command: "", transport: await openProcessTransport(await acquire(), python, cwd, signal, startTimeoutMs, limits, { PRK_TARGET_CACHE_ROOT: cacheRoot }),
    }) });
    const lease = channels.acquire("local");
    const newOwner = (scoped) => createPythonTool({ target: "local", python, cwd, acquire, processWindow, memoryMax, memorySwapMax, scoped,
      bun: { storeDir: store.directory, acquire: () => channels.acquire("local") },
    });
    try {
      const platform = await lease.request("remoteExtensions", "platform");
      assert.equal(platform.system, "Linux");
      assert.equal(platform.machine, "x86_64");
      const context = { lease, target: { system: platform.system, machine: platform.machine }, storeDir: store.directory,
        binChunkBytes: DEFAULT_CODEMODE_OPTIONS.binChunkBytes };

      await assert.rejects(lstat(join(store.directory, "manifest.json")), { code: "ENOENT" });
      await rejectStartup(newOwner(false), /no current bun artifact.*gateway/i);
      const version = await bunVersion(bun);
      await store.upload("bun", version, "x86_64", createReadStream(bun));
      const asset = await readArtifact(context, "bun", "tool");
      assert.equal(asset.path, join(cacheRoot, "bin", asset.sha256, "bun"), "Bun must deploy under the owned target cache");
      assert.equal(asset.cached, false);
      await assert.rejects(lstat(asset.path), { code: "ENOENT" });
      await rejectStartup(newOwner(false), /(?:\bbun\b.*(?:cache|deploy)|(?:cache|deploy).*\bbun\b)/i);
      await assert.rejects(lstat(asset.path), { code: "ENOENT" }, "ensure must not populate a cold cache");

      const transfer = await prepareTransfer(store.directory, asset);
      assert.equal(await transferArtifact(context, asset, transfer, environment, () => {}), true);
      assert.equal((await readArtifact(context, "bun", "tool")).cached, true);
      const executable = await realpath(asset.path);
      assert.equal(executable, asset.path, "runner must use the deployed file, not the source executable via a symlink");
      await checkRunner(newOwner(false), { cwd, executable, daemonPid, python, scoped: false });
      if (await scopeAvailable()) await checkRunner(newOwner(true), { cwd, executable, daemonPid, python, scoped: true });
      else console.log(JSON.stringify({ status: "SKIP", mode: "bun-local", scoped: true, reason: "systemd user memory scope unavailable" }));
    } finally { await lease.release(); }
  } finally { await fixture.close(); }
}

async function bunVersion(file) {
  const fd = await open(file, constants.O_RDONLY | constants.O_NONBLOCK);
  const header = Buffer.alloc(20);
  try {
    assert((await fd.stat()).isFile(), "expected a preinstalled Bun executable file");
    assert.equal((await fd.read(header, 0, header.length, 0)).bytesRead, header.length);
  } finally { await fd.close(); }
  assert.equal(header.subarray(0, 6).toString("hex"), "7f454c460201", "Bun fixture must be a 64-bit little-endian ELF");
  assert.equal(header.readUInt16LE(18), 62, "Bun fixture must be an x86_64 ELF");
  const result = spawnSync(file, ["--version"], subprocess);
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const version = result.stdout.trim();
  assert.match(version, /^\d+\.\d+\.\d+[^\s]*$/u, "expected the preinstalled Bun version");
  return version;
}

async function rejectStartup(owner, error) {
  try {
    await assert.rejects(owner.ensure(), error);
    assert.notEqual(owner.getSnapshot().connectionStatus, "connected", "no interpreter may replace missing Bun");
  } finally { await owner.close(); }
}

async function scopeAvailable() {
  const controllers = await readFile("/sys/fs/cgroup/cgroup.controllers", "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return "";
  });
  return controllers.split(/\s+/u).includes("memory") && spawnSync("systemd-run", [
    "--user", "--scope", "--quiet", "--no-ask-password", ...scopeProperties, "/bin/true",
  ], subprocess).status === 0;
}

async function checkRunner(owner, { cwd, executable, daemonPid, python, scoped }) {
  let pid;
  try {
    await owner.ensure();
    const { kernelId } = owner.getSnapshot();
    assert(kernelId, "ready Bun generation must have an identity");
    assertConnected(owner, kernelId);
    const pids = [];
    for (const entry of await readdir("/proc")) {
      if (/^[1-9]\d*$/u.test(entry) && await readlink(`/proc/${entry}/exe`).catch((error) => {
        if (!["ENOENT", "ESRCH", "EACCES", "EPERM"].includes(error.code)) throw error;
      }) === executable) pids.push(Number(entry));
    }
    assert.equal(pids.length, 1, `expected one runner using owned Bun ${executable}; found ${pids}`);
    [pid] = pids;
    const proc = `/proc/${pid}`;
    assert.equal(await readlink(`${proc}/cwd`), cwd);
    assert.equal(await readlink(`${proc}/fd/0`), "/dev/null");
    // OS-level observation only: reopen the live runner's fd0 via procfs, then duplicate
    // that handle onto the observer child's stdin. No Bun cell or test payload is evaluated.
    const stdin = await open(`${proc}/fd/0`, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
      assert.equal((await stdin.read(Buffer.alloc(1), 0, 1, null)).bytesRead, 0, "runner fd0 must read EOF");
      const child = spawnSync(python, ["-I", "-S", "-c", "import os; print(repr(os.read(0, 1)))"], {
        ...subprocess, stdio: [stdin.fd, "pipe", "pipe"],
      });
      assert.ifError(child.error);
      assert.equal(child.status, 0, child.stderr);
      assert.equal(child.stdout.trim(), "b''", "the subprocess inheriting runner fd0 must read EOF");
    } finally { await stdin.close(); }

    const cgroup = /^0::(\S+)$/mu.exec(await readFile(`${proc}/cgroup`, "utf8"))?.[1];
    if (scoped) {
      assert.match(cgroup ?? "", /\/prk-kernel-[\da-f-]+\.scope$/u, "Bun must be in the owned kernel scope");
      assert.equal((await readFile(join("/sys/fs/cgroup", cgroup, "memory.max"), "utf8")).trim(), String(512 * 1024 * 1024));
      assert.equal((await readFile(join("/sys/fs/cgroup", cgroup, "memory.swap.max"), "utf8")).trim(), memorySwapMax);
    } else assert.doesNotMatch(cgroup ?? "", /\/prk-kernel-[\da-f-]+\.scope$/u);
    await checkControlFds(proc, daemonPid);

    for (const [fd, stream, otherStream] of [[1, "stdout", "stderr"], [2, "stderr", "stdout"]]) {
      const marker = `raw Bun ${stream} diagnostic (not JSON)`;
      const pipe = await open(`${proc}/fd/${fd}`, constants.O_WRONLY | constants.O_NONBLOCK);
      try { assert.equal((await pipe.write(`${marker}\n`)).bytesWritten, Buffer.byteLength(`${marker}\n`)); }
      finally { await pipe.close(); }
      await until(() => owner.getSnapshot().diagnostics?.[stream].includes(marker), `raw fd${fd} bytes never reached ${stream} diagnostics`);
      const { diagnostics, ...snapshot } = owner.getSnapshot();
      assert(!diagnostics[otherStream].includes(marker), `fd${fd} marker reached the wrong diagnostic stream`);
      assert(!JSON.stringify(snapshot).includes(marker), `fd${fd} marker escaped diagnostics`);
      assertConnected(owner, kernelId);
      assert.equal(await readlink(`${proc}/exe`), executable, "the same owned Bun runner must remain live");
    }
  } finally { await owner.close(); }
  await until(() => lstat(`/proc/${pid}`).then(() => false, (error) => {
    if (error.code !== "ENOENT") throw error;
    return true;
  }), `owned Bun PID ${pid} remained after close`);
  console.log(JSON.stringify({ status: "PASS", mode: "bun-local", scoped, pid, runnerStdinEOF: true, inheritedStdinEOF: true,
    controlCloexec: true, diagnosticsSeparated: true, runnerExited: true }));
}

function assertConnected(owner, kernelId) {
  const snapshot = owner.getSnapshot();
  assert.equal(snapshot.language, "bun");
  assert.equal(snapshot.connectionStatus, "connected");
  assert.equal(snapshot.kernelId, kernelId);
  assert.equal(snapshot.state, "idle");
  assert.deepEqual(snapshot.activeCells, []);
}

async function checkControlFds(proc, daemonPid) {
  // Match the actual pi-env pipe peers by inode, not the original FD numbers passed at exec.
  const daemonFds = `/proc/${daemonPid}/fd`;
  const peers = new Set(await Promise.all((await readdir(daemonFds)).map((fd) => readlink(`${daemonFds}/${fd}`).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  }))));
  const directions = [];
  for (const fd of await readdir(`${proc}/fd`)) {
    const pipe = await readlink(`${proc}/fd/${fd}`);
    if (!pipe.startsWith("pipe:[") || !peers.has(pipe)) continue;
    assert(Number(fd) > 2, "control pipes must not be reachable as stdio");
    const info = await readFile(`${proc}/fdinfo/${fd}`, "utf8");
    const flags = Number.parseInt(/^flags:\s*([0-7]+)$/mu.exec(info)?.[1], 8);
    assert(flags & closeOnExec, `Bun control fd ${fd} must be CLOEXEC: ${info}`);
    directions.push(flags & 3); // O_ACCMODE, Linux: read=0, write=1.
  }
  assert.deepEqual(directions.sort(), [0, 1], "expected the daemon's private input and output pipes in Bun");
}

async function until(observe, failure) {
  const deadline = performance.now() + 5000;
  do {
    if (await observe()) return;
    await delay(20);
  } while (performance.now() < deadline);
  assert.fail(failure);
}
