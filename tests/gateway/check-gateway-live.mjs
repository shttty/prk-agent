import { stringify } from "smol-toml";
import { checkCliShutdown } from "./live/check-cli-shutdown.mjs";
import { until } from "./live/wait-condition.mjs";
import { cli } from "./live/run-cli.mjs";
import { launch } from "./live/launch-gateway.mjs";
import { bounded } from "./live/wait-bounded.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, readFile, writeFile, rm, lstat, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { assertProcessExited } from "../fixtures/target-environment/assert-process-exited.mjs";

const { values } = parseArgs({ options: {
  help: { type: "boolean" }, model: { type: "string" }, home: { type: "string" },
  extension: { type: "string", multiple: true },
} });
if (values.help) {
  console.log("Usage: node tests/gateway/check-gateway-live.mjs --model PROVIDER/MODEL --home DIR [--extension PATH ...]\nREAL paid model calls; no provider fallback. Required --home is an existing caller-prepared isolated credential home. Its agent/ holds provider-owned configuration. Gateway owns all session runtimes. Requires same-host filesystem and explicit absolute PI_TEST_PYTHON >=3.9; uses an owned local daemon. No credential copies or global configuration. Each operation is bounded to 180 seconds; unknown outcomes are never replayed.");
  process.exit(0);
}
if (!values.model?.includes("/")) throw new Error("Specify --model PROVIDER/MODEL; no model default is permitted.");
if (!values.home) throw new Error("Specify --home with an isolated credential home; no real-home fallback is permitted.");
const home = resolve(values.home);
if (!(await stat(home)).isDirectory()) throw new Error("--home must be an existing isolated credential directory.");
initializePrkHome(home);
// SDK bootstrap boundary: static SDK-dependent imports would run before the home override.
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const { createPythonTool } = await import("../../src/kernel/assemble-kernel.ts");
const { readPrkConfigDocument } = await import("../../src/config/document/read-prk-config-document.ts");
// Inventory names only, never read session contents or credentials.
async function sessionArtifacts() {
  const directory = join(home, "agent", "sessions");
  try { return (await readdir(directory, { recursive: true })).sort(); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
const originalSessions = await sessionArtifacts();
const entry = fileURLToPath(new URL("../../src/main.ts", import.meta.url));
const root = await mkdtemp(join(tmpdir(), "pi-gateway-live-"));
const socket = join(root, "gateway.sock");
async function exists(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

let fixtureRoot;
try {
  await withTargetFixture(async ({ config, runtime, signal, onCleanup, tempRoot }) => {
    fixtureRoot = tempRoot;
    let a, b, gateway, sentinel, interactive, ownedPid;
    let cleanup;
    const close = () => cleanup ??= (async () => {
      const failures = [];
      const attempt = async (action) => { try { await action(); } catch (error) { failures.push(error); } };
      a?.disconnect(); b?.disconnect();
      await attempt(() => interactive?.stop());
      await attempt(() => gateway?.stop());
      await attempt(() => sentinel?.close());
      if (ownedPid) await attempt(() => assertProcessExited(ownedPid));
      if (failures.length) throw new AggregateError(failures, "Owned live-check cleanup failed");
    })();
    onCleanup(close);
    try {
      sentinel = createPythonTool({ ...runtime, target: "live-sentinel" });
      await sentinel.tool.execute("seed-sentinel", { code: "sentinel_value=73" });
      const configPath = join(home, "config.toml");
      const document = await readPrkConfigDocument(configPath) ?? {};
      await writeFile(join(home, "instances.toml"), stringify({ instances: [{ ...config, id: "controlled", label: "Controlled instance", cwd: root }] }), { mode: 0o600 });
      await chmod(join(home, "instances.toml"), 0o600);
      await writeFile(configPath, stringify({ ...document, session: { ...document.session, workerTools: "direct" } }));
      const env = { ...process.env, PRK_HOME: home, PYTHONDONTWRITEBYTECODE: "1" };
      const args = ["gateway", "--home", home, "--socket", socket, "--no-skills", "--model", values.model];
      for (const path of values.extension ?? []) args.push("--extension", resolve(path));
      await cli(entry, root, [], env, 2);
      await cli(entry, root, ["attach", "--socket", socket, "invalid"], env, 1);
      // workbench needs no --session, so this failure is the missing endpoint itself.
      await cli(entry, root, ["attach", "--socket", socket, "workbench"], env, 1);
      assert.equal(await exists(socket), false, "failed attach must not start an Agent");
      gateway = launch(entry, root, args, env);
      await until(async () => {
        assert.equal(gateway.child.exitCode, null, "gateway startup failed (diagnostics suppressed)");
        return exists(socket);
      }, "gateway readiness", signal);
      a = await connectGateway(socket); b = await connectGateway(socket);

      // The Gateway holds no session until one is explicitly created, and it
      // never creates a main Agent to serve an ordinary worker.
      const empty = await a.request("workbench");
      assert.deepEqual(empty.sessions, [], "Gateway starts with no sessions and no hidden main session");
      assert.deepEqual(empty.targets.map(({ id }) => id), ["controlled"]);
      assert(empty.sessions.every((session) => session.kernel?.kernelId === undefined), "Gateway startup starts no session REPL");

      const created = JSON.parse(await cli(entry, root, ["attach", "--socket", socket, "create", "--target", "controlled"], env));
      const worker = created.session.sessionId;
      assert(worker && worker !== "controlled", "Routing identity is distinct from the environment name");
      const events = []; b.onEvent((event, source) => events.push({ source, event }));
      const initial = await b.request("subscribe", { sessionId: worker });
      assert.equal((await a.request("state", { sessionId: worker })).sessionId, initial.sessionId);
      assert.equal(JSON.parse(await cli(entry, root, ["attach", "--socket", socket, "state", "--session", worker], env)).sessionId, initial.sessionId);
      // A client that created nothing addresses the same managed collection.
      assert.deepEqual((await b.request("workbench")).sessions.map(({ sessionId }) => sessionId), [worker]);

      const file = join(root, "value.txt"), started = join(root, "cancel-started"), finished = join(root, "cancel-finished");
      const pidFile = join(root, "owned-repl.pid");
      const send = async (message, useCli = false) => {
        signal.throwIfAborted();
        const requestId = randomUUID();
        const deadline = Date.now() + 180_000;
        const result = useCli
          ? JSON.parse(await cli(entry, root, ["attach", "--socket", socket, "send", "--session", worker, "--request-id", requestId, "--message", message], env))
          : await a.request("send", { sessionId: worker, requestId, message });
        assert.equal(result.accepted, true, "model request must be accepted");
        assert.equal(result.sessionId, initial.sessionId);
        console.log(`LIVE worker submission accepted: requestId=${requestId} operationId=${result.operationId}`);
        return { ...result, deadline };
      };
      const terminal = async (submission) => {
        let outcome;
        await until(async () => {
          outcome = (await b.request("state", { sessionId: worker })).recentOperations.find(({ operationId }) => operationId === submission.operationId);
          return !!outcome;
        }, "real model operation terminal", signal, submission.deadline);
        return outcome;
      };
      const executing = async (submission, marker) => {
        await until(() => exists(marker), "actual Python progress marker", signal, submission.deadline);
        const state = await b.request("state", { sessionId: worker });
        assert.equal(state.operation?.operationId, submission.operationId);
        assert(state.kernel?.kernelId, "an executing worker has an observed kernel");
        const listed = (await b.request("workbench")).sessions.find((entry) => entry.sessionId === worker);
        assert.equal(listed?.state, "running");
        assert(listed.sessionId);
        return state.kernel.kernelId;
      };
      const first = await send(`Execute one Python call with your kernel_code tool: import os,time; from pathlib import Path; Path(${JSON.stringify(pidFile)}).write_text(str(os.getpid())); gateway_value=41; Path(${JSON.stringify(file)}).write_text(str(gateway_value)); time.sleep(8). This is an authorized disconnect test. Do not retry anything whose outcome is uncertain. Report only after the call returns.`);
      const observedKernel = await executing(first, file);
      a.disconnect(); a = undefined;
      assert.equal((await terminal(first)).status, "completed");
      assert(events.some(({ source, event }) => source === worker && event.type === "operation_completed" && event.operationId === first.operationId));
      assert.equal(await readFile(file, "utf8"), "41");
      ownedPid = Number(await readFile(pidFile, "utf8"));
      assert(Number.isSafeInteger(ownedPid) && ownedPid > 0);
      const kernelId = observedKernel;
      const inspect = async (expected) => {
        const state = await b.request("state", { sessionId: worker });
        const result = state.messages.findLast((message) => message.role === "toolResult" && message.toolName === "kernel_code");
        assert.equal(result?.isError, false, JSON.stringify(result));
        assert.equal(await readFile(file, "utf8"), String(expected));
        assert.equal(state.kernel.kernelId, kernelId);
      };
      await inspect(41);
      a = await connectGateway(socket);
      const reconnect = await a.request("subscribe", { sessionId: worker });
      assert.equal(reconnect.sessionId, initial.sessionId);
      assert.equal(reconnect.kernel.kernelId, kernelId);
      assert(reconnect.messages.some((message) => message.role === "toolResult" && message.toolName === "kernel_code"),
        "the worker itself executed Python; there is no main-session delegation result");
      assert(reconnect.recentOperations.some(({ operationId }) => operationId === first.operationId));
      console.log("PASS two clients share one Gateway-owned operation; disconnect during actual execution, completion observed by B, same session/REPL and file=41");
      const second = await send(`Use your kernel_code tool to increment the existing gateway_value by one WITHOUT initializing it, then update ${JSON.stringify(file)} with str(gateway_value). Report after the call returns.`, true);
      assert.equal((await terminal(second)).status, "completed");
      assert.equal(await readFile(file, "utf8"), "42"); await inspect(42);
      assert.equal((await a.request("state", { sessionId: worker })).kernel.kernelId, kernelId);
      assert.deepEqual((await a.request("workbench")).sessions.map((session) => session.kernel?.kernelId), [kernelId]);
      const cancelling = await send(`Execute one Python call: import time; from pathlib import Path; Path(${JSON.stringify(started)}).write_text('started'); time.sleep(60); Path(${JSON.stringify(finished)}).write_text('finished'). Authorized cancellation test. Do not retry interrupted execution.`);
      await executing(cancelling, started);
      const cancel = JSON.parse(await cli(entry, root, ["attach", "--socket", socket, "cancel", "--session", worker, "--operation-id", cancelling.operationId], env));
      assert.equal(cancel.status, "requested");
      const cancelled = await terminal(cancelling);
      assert(["cancelled", "unknown"].includes(cancelled.status), "acknowledgement alone is not cancellation proof");
      console.log(`LIVE intentional cancellation terminal=${cancelled.status}; next submission is a distinct read-only diagnostic, not replay`);
      assert.equal(await exists(finished), false, "cancelled side-effect tail is absent before the read-only diagnostic");
      const reuse = await send("Use your kernel_code tool to assert gateway_value == 42 and print gateway_value. Do not modify it or retry the sleep.");
      assert.equal((await terminal(reuse)).status, "completed"); await inspect(42);
      assert.equal(await exists(finished), false);
      assert.equal((await a.request("state", { sessionId: worker })).kernel.kernelId, kernelId);
      assert.deepEqual((await a.request("workbench")).sessions.map((session) => session.kernel?.kernelId), [kernelId]);
      assert(events.every(({ event }, index) => event.sequence > (index ? events[index - 1].event.sequence : initial.sequence)));
      interactive = launch(entry, root, ["attach", "--socket", socket, "--session", worker], env);
      await checkCliShutdown({ interactive, signal, b, worker, initial, cancelled, entry, root, socket, env, gateway, exists, sentinel, ownedPid });
    } finally { await close(); }
  });
  if (fixtureRoot) assert.equal(await exists(fixtureRoot), false, "owned fixture temp files removed");
} finally {
  await rm(root, { recursive: true, force: true });
  // Do not delete anything from the configuration owner's directory, even on failure.
  assert.deepEqual(await sessionArtifacts(), originalSessions,
    "worker sessions are in-memory today, so the Gateway must not create SDK session artifacts");
}
assert.equal(await exists(root), false);
console.log("PASS REAL Gateway same-host acceptance; owned processes settled, sentinel preserved until its own close and temporary files removed; no replay or deployment claim");
