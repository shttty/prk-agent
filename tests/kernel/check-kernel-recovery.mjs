import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { assertProcessExited } from "../fixtures/target-environment/assert-process-exited.mjs";


const deadline = (promise, label, milliseconds = 60000) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), milliseconds);
  })]).finally(() => clearTimeout(timer));
};

async function gateway(root, config, serial, targetCwd = root) {
  const { JUPYTER_URL: _url, JUPYTER_TOKEN: _token, ...env } = process.env;
  const socket = join(root, `gateway-${serial}.sock`);
  const child = spawn(process.execPath, [fileURLToPath(new URL("../fixtures/recovery-process-fixture.mjs", import.meta.url))], {
    env, stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  const exit = once(child, "exit");
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const ready = once(child, "message");
  child.send({ root, historyDir: join(root, "history"), socket, config, targetCwd });
  let client;
  try {
    const [message] = await deadline(ready, "Gateway startup");
    assert.equal(message.type, "ready", `${JSON.stringify(message)} ${stderr}`);
    client = await connectGateway(socket);
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await exit;
    throw error;
  }
  return {
    client, socket,
    async kill() {
      child.kill("SIGKILL");
      const [, signal] = await deadline(exit, "abnormal Gateway exit");
      assert.equal(signal, "SIGKILL");
      client.disconnect();
    },
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try {
        await client.request("shutdown");
        assert.equal((await deadline(exit, "normal Gateway shutdown"))[0], 0, stderr);
      } finally {
        client.disconnect();
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL"); await exit;
        }
      }
    },
    async sideEffect(action) {
      const finished = new Promise((resolve) => {
        const listener = (value) => {
          if (value.type === "side-effect-finished") { child.off("message", listener); resolve(); }
        };
        child.on("message", listener);
      });
      const accepted = await action();
      await deadline(finished, "controlled side effect before owner crash");
      return accepted;
    },
  };
}

async function execute(owner, worker, requestId, code) {
  const { client } = owner;
  await client.request("subscribe", { sessionId: worker });
  let unsubscribe;
  const completed = new Promise((resolve) => {
    unsubscribe = client.onEvent((event, name) => {
      if (name === worker && event.type === "operation_completed" && event.details?.requestIds?.includes(requestId)) resolve(event.details);
    });
  });
  try {
    const accepted = await client.request("send", { sessionId: worker, requestId, message: JSON.stringify({ code }) });
    assert.equal(accepted.accepted, true);
    assert.equal((await deadline(completed, requestId)).status, "completed");
    return await client.request("state", { sessionId: worker });
  } finally { unsubscribe?.(); }
}

function lastKernelCode(snapshot) {
  return [...snapshot.messages].reverse().find((message) => message.role === "toolResult" && message.toolName === "kernel_code");
}

function resultText(result) {
  return typeof result?.content === "string" ? result.content : (result?.content ?? []).map((part) => part.text ?? "").join("\n");
}

await withTargetFixture(async ({ config, runtime, signal, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-kernel-recovery-"));
  const sentinel = createPythonTool({ ...runtime, target: "unrelated-sentinel" });
  const owners = [];
  let browser;
  onCleanup(async () => {
    const results = await Promise.allSettled([browser?.close(), ...owners.map((owner) => owner.stop())]);
    await sentinel.close();
    await rm(root, { recursive: true, force: true });
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) throw new AggregateError(failed.map((result) => result.reason), "Recovery fixture cleanup failed");
  });
  const acquisitions = () => readFile(join(root, "target-acquires"), "utf8");
  await sentinel.tool.execute("sentinel", { code: "sentinel_value = 73" }, signal);
  let owner = await gateway(root, config, 1); owners.push(owner);
  const created = await owner.client.request("createSession", { target: "recovery-target" });
  const worker = created.session.sessionId;
  const sessionId = created.snapshot.sessionId;
  assert.equal(created.session.cwd, root);
  const initialized = await execute(owner, worker, "initialize", "import os\nrecovery_value = 41\nprint(recovery_value)\nprint('OWNED_PID', os.getpid())");
  const kernelId = initialized.kernel.kernelId;
  const originalPid = Number(/OWNED_PID (\d+)/.exec(resultText(lastKernelCode(initialized)))[1]);
  assert.match(resultText(lastKernelCode(initialized)), /(?:^|\n)41(?:\n|$)/);
  const sideEffectPath = join(root, "side-effect-counter");
  const accepted = await owner.sideEffect(() => owner.client.request("send", {
    sessionId: worker, requestId: "unknown-side-effect", message: JSON.stringify({
      hold: true,
      code: `from pathlib import Path\np = Path(${JSON.stringify(sideEffectPath)})\np.write_text(str(int(p.read_text()) + 1) if p.exists() else '1')\nprint('side-effect-done')`,
    }),
  }));
  assert.equal(accepted.accepted, true);
  assert.equal(await readFile(sideEffectPath, "utf8"), "1");
  const callsBeforeCrash = await readFile(join(root, "provider-calls"), "utf8");
  const acquiresBeforeCrash = await acquisitions();
  await owner.kill();
  await assertProcessExited(originalPid);
  assert.match(resultText(await sentinel.tool.execute("sentinel-after-crash", { code: "print(sentinel_value)" })), /73/);

  const changedCwd = join(root, "changed-cwd");
  await mkdir(changedCwd);

  owner = await gateway(root, config, 2, changedCwd); owners.push(owner);
  const history = await owner.client.request("history", { sessionId: worker });
  assert.equal(history.snapshot.sessionId, sessionId);
  assert.equal(history.readOnly, true);
  assert.equal(await readFile(join(root, "provider-calls"), "utf8"), callsBeforeCrash, "Browsing never calls the model");
  assert.equal(await acquisitions(), acquiresBeforeCrash, "Browsing never acquires a target");
  if (process.env.PI_TEST_RECOVERY_BROWSER === "1") {
    const { createRecoveryBrowser } = await import("../fixtures/recovery-browser-fixture.mjs");
    browser = await createRecoveryBrowser();
    await browser.open(owner.socket, sessionId);
    const opened = await owner.client.request("state", { sessionId: worker });
    assert.equal(opened.state, "closed", "Browser history opening does not restore execution");
    assert.equal(opened.kernel?.kernelId, undefined, "Browser history opening binds no kernel");
    assert.equal(await acquisitions(), acquiresBeforeCrash, "Browser history opening acquires no target");
  }
  const recovered = browser ? await browser.recover() : await owner.client.request("recoverSession", { sessionId: worker, mode: "auto" });
  assert.equal(recovered.session.recovery.status, "new", "Recovery creates a fresh owned REPL after Gateway loss");
  assert.equal(recovered.session.cwd, root, "Saved session cwd survives instance default changes");
  assert.equal(recovered.snapshot.sessionId, sessionId);
  assert.notEqual(recovered.snapshot.kernel.kernelId, kernelId);
  assert.equal(await readFile(join(root, "provider-calls"), "utf8"), callsBeforeCrash, "Recovery never calls or replays the model");
  assert.equal(await readFile(sideEffectPath, "utf8"), "1", "Unknown side effect was not replayed");
  const continued = await execute(owner, worker, "continue-new-runtime", `import os\nassert os.getcwd() == ${JSON.stringify(root)}\nassert 'recovery_value' not in globals()\nprint('OWNED_PID', os.getpid())`);
  const secondPid = Number(/OWNED_PID (\d+)/.exec(resultText(lastKernelCode(continued)))[1]);
  assert.notEqual(continued.kernel.kernelId, kernelId);
  assert.equal(await readFile(sideEffectPath, "utf8"), "1");
  await owner.kill();
  await assertProcessExited(secondPid);

  owner = await gateway(root, config, 3, changedCwd); owners.push(owner);
  const callsBeforeDead = await readFile(join(root, "provider-calls"), "utf8");
  if (browser) await browser.open(owner.socket, sessionId, true);
  const beforeRejected = await acquisitions();
  await assert.rejects(owner.client.request("recoverSession", { sessionId: worker, mode: "reconnect" }), (error) => error.code === "INVALID_REQUEST");
  assert.equal(await acquisitions(), beforeRejected, "Removed recovery mode is rejected before target acquisition");
  const fresh = browser ? await browser.recover() : await owner.client.request("recoverSession", { sessionId: worker, mode: "auto" });
  assert.equal(fresh.session.recovery.status, "new");
  const freshKernelId = fresh.snapshot.kernel.kernelId;
  assert(freshKernelId, "Fresh recovery reports its concrete kernel identity");
  assert.equal(await readFile(join(root, "provider-calls"), "utf8"), callsBeforeDead, "Explicit new creates execution resources without replaying a model turn");
  const absent = await execute(owner, worker, "new-variable-absent", `import os\nassert os.getcwd() == ${JSON.stringify(root)}\nprint('OLD_VARIABLE_PRESENT', 'recovery_value' in globals())\nprint('OWNED_PID', os.getpid())`);
  assert(resultText(lastKernelCode(absent)).split("\n").includes("OLD_VARIABLE_PRESENT False"));
  assert.notEqual(absent.kernel.kernelId, kernelId);
  assert.equal(await readFile(sideEffectPath, "utf8"), "1");
  const finalPid = Number(/OWNED_PID (\d+)/.exec(resultText(lastKernelCode(absent)))[1]);
  await owner.stop();
  await assertProcessExited(finalPid);
  assert(resultText(await sentinel.tool.execute("sentinel-check", { code: "print(sentinel_value)" }, signal)).split("\n").includes("73"));
  for (const file of await readdir(join(root, "history"))) {
    const entries = (await readFile(join(root, "history", file), "utf8")).trim().split("\n").map(JSON.parse);
    for (const entry of entries.filter((entry) => entry.customType === "gateway-session-binding")) {
      assert.deepEqual(Object.keys(entry.data).sort(), ["cwd", "sessionId", "target", "version"]);
    }
  }
  console.log("PASS recovery: actual SIGKILL invalidates owned processes; fresh REPL with saved cwd/identity; history has no target/model side effects; no replay; sentinel survives crash and normal shutdown");
});
