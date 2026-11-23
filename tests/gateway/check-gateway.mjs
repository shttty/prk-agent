import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { launch } from "./contract/launch-gateway-process.mjs";
import { assertProcessExited } from "../fixtures/target-environment/assert-process-exited.mjs";

// End-to-end: a separately launched Gateway process owns every worker session
// (there is no main Agent anywhere), addressed by two independent socket
// clients and by the attach CLI. Only the model responses are controlled; the
// SDK worker sessions, private transport and owned Python REPLs are real.
const entry = fileURLToPath(new URL("../../src/main.ts", import.meta.url));
const extension = fileURLToPath(new URL("../fixtures/gateway-test-provider.mjs", import.meta.url));
const root = await mkdtemp(join(tmpdir(), "pi-gateway-check-"));
const socket = join(root, "gateway.sock");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (result) => typeof result?.content === "string"
  ? result.content
  : (result?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
async function until(predicate, description, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await predicate()) return; await sleep(25); }
  throw new Error(`Timed out: ${description}`);
}
async function exists(path) { try { await lstat(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
async function cli(args, env, code = 0) {
  const run = launch(entry, root, args, env); const timer = setTimeout(() => run.child.kill("SIGKILL"), 60_000);
  try { assert.equal(await run.done, code, `CLI exit; stderr=${run.stderr}`); return run.stdout; }
  finally { clearTimeout(timer); }
}
let gateway, a, b;
try {
  await withTargetFixture(async ({ config, runtime, onCleanup, signal }) => {
    const workerConfig = join(root, "config.toml");
    await writeFile(workerConfig, stringify({ session: { workerTools: "direct" } }));
    await writeFile(join(root, "instances.toml"), stringify({ instances: [{ ...config, id: "controlled", label: "Controlled instance", cwd: root }] }), { mode: 0o600 });
    await mkdir(join(root, "agent"), { recursive: true });
    const env = { ...process.env, HOME: root, XDG_CONFIG_HOME: join(root, "config"), XDG_CACHE_HOME: join(root, "cache"), XDG_DATA_HOME: join(root, "data"),
      PRK_HOME: root, PI_OFFLINE: "1", PYTHONDONTWRITEBYTECODE: "1" };
    const sentinel = createPythonTool({ ...runtime, target: "gateway-check-sentinel" });
    onCleanup(() => sentinel.close());
    const sentinelResult = await sentinel.tool.execute("sentinel", { code: "import os\nsentinel_value = 73\nprint(os.getpid())" }, signal);
    const sentinelPid = Number(text(sentinelResult).trim());
    assert(Number.isSafeInteger(sentinelPid) && sentinelPid > 0);

    await cli([], env, 2);
    // Attaching to a missing endpoint fails and starts nothing locally.
    await cli(["attach", "--socket", socket, "workbench"], env, 1);
    await cli(["attach", "--socket", socket, "state", "--session", "anything"], env, 1);
    await cli(["attach", "--socket", socket, "state", "--worker", "anything"], env, 1);
    assert.equal(await exists(socket), false, "attach failure cannot start a local Gateway");
    assert.equal(process.kill(sentinelPid, 0), true, "A failed attach leaves the independent sentinel alive");

    gateway = launch(entry, root, ["gateway", "--socket", socket, "--no-skills", "--model", "gateway-check/controlled", "--extension", extension], env);
    const stopGateway = async () => {
      if (gateway.child.exitCode === null && gateway.child.signalCode === null) {
        gateway.child.kill("SIGTERM");
        const timer = setTimeout(() => gateway.child.kill("SIGKILL"), 10_000);
        try { await gateway.done; } finally { clearTimeout(timer); }
      }
    };
    onCleanup(stopGateway);
    await until(async () => { if (gateway.child.exitCode !== null) throw new Error(`Gateway startup exited: ${gateway.stderr}`); return exists(socket); }, "gateway ready");

    // The Gateway owns workers and holds no main Agent session: the workbench
    // lists configured execution environments and zero conversations.
    const cliWorkbench = JSON.parse(await cli(["attach", "--socket", socket, "workbench"], env));
    assert.deepEqual(cliWorkbench.targets.map(({ id, label }) => ({ id, label })), [{ id: "controlled", label: "Controlled instance" }]);
    assert.deepEqual(cliWorkbench.sessions, [], "The Gateway starts with no worker session and no hidden main session");
    assert.equal(cliWorkbench.targets[0].python, config.python);
    for (const removed of ["url", "token", "defaultKernelName"]) assert.equal(Object.hasOwn(cliWorkbench.targets[0], removed), false);

    a = await connectGateway(socket); b = await connectGateway(socket);
    const lifecycle = []; b.onCollectionEvent((event) => lifecycle.push(event));
    assert.deepEqual((await b.request("subscribeSessions")).sessions, [], "Collection subscription starts from the authoritative empty list");

    // attach create allocates a routing identity distinct from the environment
    // name and from the SDK session id; the other socket clients see it too.
    // Python is selected by the instance, not the create request.
    const created = JSON.parse(await cli(["attach", "--socket", socket, "create", "--target", "controlled"], env));
    const primary = created.session.sessionId;
    assert(primary && created.snapshot.sessionId, "create returns identity and first snapshot");
    assert.equal(created.session.target, "controlled");
    assert.equal(created.session.cwd, root);
    assert.notEqual(primary, "controlled", "Routing identity is not the instance ID");
    assert.equal(primary, created.snapshot.sessionId, "Routing identity is the native SDK session id");
    await until(() => lifecycle.some((event) => event.sessionId === primary), "collection lifecycle reaches a second client");
    const cliCollection = JSON.parse(await cli(["attach", "--socket", socket, "workbench"], env));
    assert.deepEqual(cliCollection.sessions.map(({ sessionId }) => sessionId), [primary],
      "CLI list addresses the same managed collection as CLI create");
    assert.deepEqual((await b.request("workbench")).sessions.map(({ sessionId }) => sessionId), [primary],
      "A client that created nothing addresses the same managed collection");
    assert.equal(created.snapshot.kernel.state, "not_started", "Session creation stays lazy about its REPL");

    const events = []; b.onEvent((event, worker) => events.push({ event, sessionId: worker }));
    const initial = await b.request("subscribe", { sessionId: primary });
    assert.equal(initial.sessionId, created.snapshot.sessionId);
    assert.equal((await a.request("state", { sessionId: primary })).sessionId, initial.sessionId);
    assert.equal(JSON.parse(await cli(["attach", "--socket", socket, "state", "--session", primary], env)).sessionId, initial.sessionId);

    const file = join(root, "value.txt"), started = join(root, "cancel-started"), finished = join(root, "cancel-finished");
    const primaryPidFile = join(root, "primary.pid"), secondaryPidFile = join(root, "secondary.pid");
    const send = async (client, worker, requestId, message) => {
      signal.throwIfAborted(); const result = await client.request("send", { sessionId: worker, requestId, message });
      assert.equal(result.accepted, true, JSON.stringify(result)); return result;
    };
    const terminal = async (worker, operationId) => {
      let completion;
      await until(async () => {
        const state = await b.request("state", { sessionId: worker });
        completion = state.recentOperations.find((item) => item.operationId === operationId);
        return !!completion;
      }, "operation terminal");
      return completion;
    };

    // Real Python 41 -> 42 through CLI send after CLI create/list, across a client disconnect and reconnect.
    const first = JSON.parse(await cli(["attach", "--socket", socket, "send", "--session", primary,
      "--request-id", "first", "--message", `import os,time\nfrom pathlib import Path\nPath(${JSON.stringify(primaryPidFile)}).write_text(str(os.getpid()))\ngateway_value=41\nPath(${JSON.stringify(file)}).write_text(str(gateway_value))\ntime.sleep(3)`], env));
    assert.equal(first.accepted, true, JSON.stringify(first));
    await until(() => exists(file), "real kernel executing");
    const running = await b.request("state", { sessionId: primary });
    assert.equal(running.operation.operationId, first.operationId);
    assert.equal(running.state, "running");
    const primaryKernel = running.kernel.kernelId;
    assert(primaryKernel, "A running worker reports its own managed kernel");
    const primaryPid = Number(await readFile(primaryPidFile, "utf8"));
    assert.equal(process.kill(primaryPid, 0), true, "The Gateway's recorded REPL process is live");
    a.disconnect(); a = undefined;
    assert.equal((await terminal(primary, first.operationId)).status, "completed");
    assert(events.some(({ event, sessionId: worker }) => worker === primary && event.type === "operation_completed" && event.operationId === first.operationId));
    assert.equal(await readFile(file, "utf8"), "41");

    a = await connectGateway(socket);
    const reconnect = await a.request("state", { sessionId: primary });
    assert.equal(reconnect.sessionId, initial.sessionId);
    assert.equal(reconnect.kernel.kernelId, primaryKernel, "Reconnect finds the same retained kernel");
    const duplicate = await a.request("send", { sessionId: primary, requestId: "first", message: "must not execute" });
    assert.equal(duplicate.accepted, false, "A replayed requestId is refused");
    const incremented = JSON.parse(await cli(["attach", "--socket", socket, "send", "--session", primary, "--request-id", "second",
      "--message", `gateway_value += 1\nPath(${JSON.stringify(file)}).write_text(str(gateway_value))`], env));
    assert.equal(incremented.accepted, true); assert.equal((await terminal(primary, incremented.operationId)).status, "completed");
    assert.equal(await readFile(file, "utf8"), "42");
    const concurrent = await Promise.all([a.request("state", { sessionId: primary }), b.request("messages", { sessionId: primary })]);
    assert(concurrent.every((value) => value.sessionId === initial.sessionId));
    assert(concurrent.every((value) => value.streamId === initial.streamId), "state and messages counters carry their host stream identity");

    // Cancel reaches the real kernel and leaves reusable Python state.
    const cancelling = await send(a, primary, "cancel", `Path(${JSON.stringify(started)}).write_text('started')\ntime.sleep(30)\nPath(${JSON.stringify(finished)}).write_text('done')`);
    await until(() => exists(started), "kernel cancellation marker");
    const cancel = JSON.parse(await cli(["attach", "--socket", socket, "cancel", "--session", primary, "--operation-id", cancelling.operationId], env));
    assert.equal(cancel.status, "requested");
    assert(["cancelled", "unknown"].includes((await terminal(primary, cancelling.operationId)).status));
    assert.equal(await exists(finished), false);
    const reuse = await send(a, primary, "reuse", "assert gateway_value == 42\nprint(gateway_value)");
    assert.equal((await terminal(primary, reuse.operationId)).status, "completed");
    assert.equal((await a.request("state", { sessionId: primary })).kernel.kernelId, primaryKernel, "Cancel leaves the kernel reusable");
    assert(events.every(({ event }, index) => event.sequence > (index ? events[index - 1].event.sequence : initial.sequence)));
    assert(events.every(({ sessionId: worker }) => worker === primary), "One subscription never leaks another worker's events");
    assert(events.every(({ event }) => event.streamId === initial.streamId));
    // User-authored debugging content must survive the real SDK/kernel/wire path unchanged.
    const diagnostic = "http://debug.invalid fixture-only-token Bearer debug-auth https://user:pass@example.test/?token=debug-token&api_key=debug-key";
    const printed = await send(a, primary, "raw-diagnostic", `print(${JSON.stringify(diagnostic)})`);
    assert.equal((await terminal(primary, printed.operationId)).status, "completed");
    const rawSnapshot = await a.request("state", { sessionId: primary });
    assert(rawSnapshot.messages.some((message) => message.role === "toolResult" && text(message).includes(diagnostic)), "tool output keeps URL, token and credential-shaped text");
    assert(JSON.stringify(events).includes("fixture-only-token"), "Live events keep user-authored token text");
    const rawMessages = await a.request("messages", { sessionId: primary });
    assert(JSON.stringify(rawMessages).includes("fixture-only-token"), "Messages results keep original content");
    const toolResult = rawSnapshot.messages.findLast((message) => message.role === "toolResult");
    const fullContent = await a.request("toolContent", { sessionId: primary, toolCallId: toolResult.toolCallId });
    assert(text(fullContent.result).includes(diagnostic), "on-demand tool content keeps the original output");

    // A second worker on the SAME configured environment stays isolated.
    const sibling = await a.request("createSession", { target: "controlled" });
    const secondary = sibling.session.sessionId;
    assert.notEqual(secondary, primary);
    assert.notEqual(sibling.snapshot.sessionId, initial.sessionId, "One environment yields independent SDK sessions");
    const siblingRun = await send(a, secondary, "sibling-init", `import os,sys\nfrom pathlib import Path\nPath(${JSON.stringify(secondaryPidFile)}).write_text(str(os.getpid()))\nassert os.path.samefile(sys.executable, ${JSON.stringify(config.python)})\nisolated_value = 7\nprint('sibling=', isolated_value, flush=True)`);
    assert.equal((await terminal(secondary, siblingRun.operationId)).status, "completed");
    const secondaryKernel = (await a.request("state", { sessionId: secondary })).kernel.kernelId;
    const secondaryPid = Number(await readFile(secondaryPidFile, "utf8"));
    assert(secondaryKernel && secondaryKernel !== primaryKernel, "Each worker on one environment owns its own kernel");
    assert.notEqual(secondaryPid, primaryPid, "Sessions own distinct REPL processes");
    const isolation = await send(a, primary, "isolation", "assert 'isolated_value' not in globals()\nassert gateway_value == 42\nprint('isolated', flush=True)");
    assert.equal((await terminal(primary, isolation.operationId)).status, "completed");

    const interactive = launch(entry, root, ["attach", "--socket", socket, "--session", secondary], env);
    await until(() => interactive.stdout.includes('"snapshot"'), "interactive attach snapshot");
    interactive.child.stdin.end("/state\n/workbench\n/quit\n"); assert.equal(await interactive.done, 0);
    assert(interactive.stdout.includes('"targets"'), "interactive /workbench lists the managed collection");
    assert.equal((await b.request("state", { sessionId: primary })).sessionId, initial.sessionId);

    // Closing one worker releases only that worker's kernel.
    await b.request("unsubscribe");
    assert.deepEqual(JSON.parse(await cli(["attach", "--socket", socket, "close-session", "--session", primary], env)), { closed: true });
    await assertProcessExited(primaryPid);
    const archived = await a.request("state", { sessionId: primary });
    assert(archived.messages.some((message) => message.role === "toolResult" && text(message).includes(diagnostic)), "closed-session history keeps original content");
    assert.equal(process.kill(secondaryPid, 0), true, "A sibling on the same instance keeps its REPL process");
    assert.match(text(await sentinel.tool.execute("sentinel-live", { code: "print(sentinel_value)" }, signal)), /73/,
      "The unrelated sentinel kernel is untouched");
    const survive = await send(a, secondary, "survive", "assert isolated_value == 7\nprint('sibling-survives', flush=True)");
    assert.equal((await terminal(secondary, survive.operationId)).status, "completed");
    assert.equal((await a.request("state", { sessionId: secondary })).kernel.kernelId, secondaryKernel);

    // Explicit shutdown closes the Gateway and releases only its own resources.
    assert.equal(JSON.parse(await cli(["attach", "--socket", socket, "shutdown"], env)).closed, true);
    await until(() => gateway.child.exitCode !== null, "gateway exits after native listener/owned-kernel shutdown", 20_000);
    assert.equal(await gateway.done, 0); assert.equal(await exists(socket), false);
    await assertProcessExited(secondaryPid);
    assert.match(text(await sentinel.tool.execute("sentinel-after", { code: "print(sentinel_value)" }, signal)), /73/,
      "Gateway shutdown leaves the independent sentinel alive");
    await sentinel.close();
    await assertProcessExited(sentinelPid);
    console.log("PASS: separate Gateway process; attach CLI and two clients share managed workers; real Python 41→42 across reconnect; kernel cancellation/reuse; same-instance isolation, unchanged published content, owned-only close/shutdown and no local fallback");
  });
} finally {
  a?.disconnect(); b?.disconnect();
  if (gateway && gateway.child.exitCode === null && gateway.child.signalCode === null) { gateway.child.kill("SIGTERM"); await gateway.done; }
  await rm(root, { recursive: true, force: true });
}
