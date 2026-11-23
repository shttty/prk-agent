import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { rm } from "node:fs/promises";
import { createOwnedEnvironment } from "../fixtures/target-environment/create-owned-environment.mjs";
import { createSession } from "../kernel/fixtures/create-session.mjs";
import { runOwnedShell } from "../fixtures/target-environment/run-owned-shell.mjs";
import { quoteShell } from "../../src/target-environment/daemon/quote-shell.mjs";
import { observeProcesses } from "./runtime-channel/observe-processes.mjs";

const mode = process.argv[2] ?? "local";
const actions = process.argv[3]?.split(",") ?? ["normal", "disconnect", "gateway-kill"];
const scopes = process.argv[4]?.split(",") ?? ["scoped", "unscoped"];
assert(["local", "office"].includes(mode));
assert(actions.length && actions.every((action) => ["normal", "disconnect", "gateway-kill"].includes(action)));
assert(scopes.length && scopes.every((scope) => ["scoped", "unscoped"].includes(scope)));
assert(process.env.PI_TEST_PYTHON && !process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN);
if (mode === "office") assert(process.env.PI_TEST_SSH);
const command = mode === "office" ? process.env.PI_TEST_SSH : "exec /bin/sh";
const observer = { observe: (script) => runOwnedShell(command, script) };
const guard = await createOwnedEnvironment({ prefix: "prk-S5-guard-", remoteCommand: mode === "office" ? command : undefined });
const sentinel = await createSession({ home: guard.localRoot, root: guard.root, python: mode === "office" ? "/usr/bin/python3" : process.env.PI_TEST_PYTHON,
  acquire: () => guard.acquire(mode === "office" ? "shell" : "local") });
const seeded = await sentinel.run("import os\nd7_guard=24680\nprint('D7_GUARD_PID='+str(os.getpid()))");
assert(!seeded.result.isError, seeded.text);
const guardPid = Number(/D7_GUARD_PID=(\d+)/.exec(seeded.text)?.[1]);
assert(guardPid > 0);
console.log(JSON.stringify({ phase: "observer-ready", mode, observerPid: process.pid, guardPid, actions, scopes }));
function message(child, kind) {
  return new Promise((resolve, reject) => {
    const clean = () => { child.off("message", receive); child.off("exit", exited); child.off("error", failed); };
    const receive = (value) => { if (value.kind === kind) { clean(); resolve(value); } };
    const exited = (code, signal) => { clean(); reject(new Error(`Gateway exited before ${kind}: ${code}/${signal}`)); };
    const failed = (error) => { clean(); reject(error); };
    child.on("message", receive); child.once("exit", exited); child.once("error", failed);
  });
}
try {
  for (const scopeMode of scopes) for (const action of actions) {
    const child = fork(new URL("./host/run-cleanup-gateway.mjs", import.meta.url), [mode, action, scopeMode], { stdio: ["ignore", "pipe", "pipe", "ipc"] });
    assert(child.pid > 0 && child.pid !== process.pid);
    child.stdout.pipe(process.stdout, { end: false });
    child.stderr.pipe(process.stderr, { end: false });
    const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
    let paths, record, shutdownErrors, cleaned = false;
    child.on("message", (value) => {
      if (value.kind === "owned") { paths = value.paths; console.log(JSON.stringify({ phase: "owned", mode, action, scopeMode, paths })); }
      if (value.kind === "shutdown-error") { shutdownErrors = value.errors; console.log(JSON.stringify({ phase: "shutdown-diagnostic", mode, action, scopeMode, errors: shutdownErrors })); }
    });
    try {
      ({ record } = await message(child, "ready"));
      assert.equal(record.gatewayPid, child.pid);
      assert.equal(Boolean(record.tree.scope), scopeMode === "scoped");
      assert.notEqual(record.tree.pid, record.tree.rootPid);
      console.log(JSON.stringify({ phase: "before-cleanup", ...record, guardPid }));
      if (action === "normal") {
        const closed = message(child, "closed");
        child.send({ action: "close-host" });
        await closed;
      } else if (action === "disconnect") {
        const pid = mode === "office" ? record.connection.loginPid : record.connection.wrapperPid;
        assert(pid > 0 && pid !== process.pid && pid !== child.pid);
        process.kill(pid, "SIGKILL");
      } else {
        child.kill("SIGKILL");
        assert.equal((await exited).signal, "SIGKILL");
      }
      const hostPids = [record.tree.pid, record.tree.rootPid, record.tree.ordinary, record.tree.nohup, record.tree.escaped].filter(Boolean);
      await observeProcesses(observer, hostPids, { gone: true });
      if (record.tree.scope) {
        const populated = await observer.observe(`if [ -d ${quoteShell(record.tree.scope)} ]; then cat ${quoteShell(`${record.tree.scope}/cgroup.events`)}; fi\n`);
        assert(!/^populated 1$/mu.test(populated), populated);
      }
      const socketDirectory = await observer.observe(`test ! -d ${quoteShell(record.tree.directory)} && printf REMOVED\n`);
      assert.equal(socketDirectory.trim(), "REMOVED");
      if (action === "normal") {
        const alive = await observeProcesses(observer, [record.protectedHost.pid, record.protectedHost.rootPid, record.kernelPid]);
        for (const pid of [record.protectedHost.pid, record.protectedHost.rootPid, record.kernelPid]) assert(new RegExp(`(^|\\n)\\s*${pid}\\s`).test(alive), alive);
      }
      const retained = await sentinel.run(`assert d7_guard==24680\nassert os.getpid()==${guardPid}\nprint('D7_GUARD_RETAINED')`);
      assert(!retained.result.isError, retained.text);
      if (action !== "gateway-kill") {
        child.send({ action: "finish" });
        const completion = await exited;
        if (action === "disconnect") {
          assert.deepEqual(shutdownErrors, [{ message: "Kernel closed; owned process cleanup unconfirmed.",
            code: "UNAVAILABLE", details: { closed: true }, cause: "Kernel cleanup unconfirmed after target connection loss." }]);
          assert.deepEqual(completion, { code: 1, signal: null });
        } else assert.deepEqual(completion, { code: 0, signal: null });
      }
      await observeProcesses(observer, [record.runtime.pid, record.runtime.child, record.runtime.daemon, record.kernelPid,
        record.protectedHost?.pid, record.protectedHost?.rootPid].filter(Boolean), { gone: true });
      cleaned = true;
      console.log(JSON.stringify({ status: "PASS", mode, action, scopeMode, hostPids, scope: record.tree.scope,
        synchronousFreeze: record.synchronousFreeze, independentKernelRetained: guardPid, hostNohupKilled: true,
        escapedInScopeKilled: Boolean(record.tree.escaped), shutdownErrors }));
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await exited;
      if (record && !cleaned) {
        const pids = [record.tree.pid, record.tree.rootPid, record.tree.ordinary, record.tree.nohup, record.tree.escaped,
          record.runtime.pid, record.runtime.child, record.runtime.daemon, record.kernelPid, record.protectedHost?.pid, record.protectedHost?.rootPid].filter(Boolean);
        await observer.observe(`kill -KILL ${pids.join(" ")} 2>/dev/null || true\n`);
      }
      if (paths) {
        await observer.observe(`rm -rf ${quoteShell(paths.root)}\n`);
        await rm(paths.localRoot, { recursive: true, force: true });
        await rm(paths.home, { recursive: true, force: true });
      }
    }
  }
} finally { await sentinel.close(); await guard.close(); }
