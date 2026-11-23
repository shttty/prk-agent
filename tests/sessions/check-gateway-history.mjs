import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { createSessionCollection } from "../../src/sessions/collection/assemble-collection.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { createPythonTool } from "../../src/kernel/assemble-kernel.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";

async function bounded(promise, description, milliseconds = 60_000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${description}`)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function inspectInFreshGatewayProcess(root, directory, worker) {
  const socket = join(root, "fresh-process.sock");
  const source = `
    import { initializePrkHome } from ${JSON.stringify(new URL("../../src/config/home/initialize-prk-home.ts", import.meta.url).href)};
    initializePrkHome(process.argv[1]);
    // This fresh-process boundary must bind the home before SDK-dependent modules load.
    const { createGatewayHost } = await import(${JSON.stringify(new URL("../../src/gateway/host/start-host.ts", import.meta.url).href)});
    const { startGateway } = await import(${JSON.stringify(new URL("../../src/gateway/socket-server/start-listener.ts", import.meta.url).href)});
    const host = await createGatewayHost({cwd:process.argv[1],home:process.argv[1],historyDir:process.argv[2],model:'offline/unavailable',targets:[]});
    const endpoint = await startGateway(host, process.argv[3]);
    process.send({ready:true});
    await endpoint.closed;
    process.disconnect();
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", source, root, directory, socket], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
  const exited = once(child, "exit");
  const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
  let connection;
  try {
    await once(child, "message", { signal: AbortSignal.timeout(25_000) });
    connection = await connectGateway(socket);
    const result = await connection.request("history", { sessionId: worker });
    await connection.request("shutdown");
    assert.equal((await exited)[0], 0, "Fresh Gateway process exits cleanly");
    return result;
  } finally {
    clearTimeout(timer);
    connection?.disconnect();
    if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await exited; }
  }
}

await withTargetFixture(async ({ config, runtime, signal, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-gateway-history-"));
  const directory = join(root, "history");
  const sentinel = createPythonTool({ ...runtime, target: "history-sentinel" });
  let host, endpoint, client;
  onCleanup(async () => {
    const cleanup = await Promise.allSettled([client?.disconnect(), endpoint ? endpoint.close() : host?.close(), sentinel.close()]);
    await rm(root, { recursive: true, force: true });
    const failures = cleanup.filter((result) => result.status === "rejected").map((result) => result.reason);
    if (failures.length) throw new AggregateError(failures, "History fixture cleanup failed");
  });
  const ownedPids = new Set();
  const kernels = async () => [...ownedPids].filter((pid) => {
    try { process.kill(pid, 0); return true; } catch (error) { if (error.code === "ESRCH") return false; throw error; }
  }).sort();
  const sentinelPid = join(root, "sentinel-pid"), workerPid = join(root, "worker-pid");
  await sentinel.tool.execute("sentinel", { code: `import os\nfrom pathlib import Path\nhistory_sentinel = 73\nPath(${JSON.stringify(sentinelPid)}).write_text(str(os.getpid()))` }, signal);
  ownedPids.add(Number(await readFile(sentinelPid, "utf8")));
  const baseline = await kernels();
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const faux = fauxProvider({ provider: "history-controlled", models: [{ id: "local" }], tokensPerSecond: 5000 });
  modelRuntime.registerNativeProvider(faux.provider);
  let calls = 0;
  faux.setResponses(Array.from({ length: 20 }, () => async (context) => {
    calls += 1;
    if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("History result: 41");
    return fauxAssistantMessage(fauxToolCall("kernel_code", { code: `import os\nfrom pathlib import Path\nPath(${JSON.stringify(workerPid)}).write_text(str(os.getpid()))\nhistory_value = 41\nprint(history_value)` }), { stopReason: "toolUse" });
  }));
  const targets = [executionTargetFromConfig({ ...config, id: "stable-target", label: "Stable instance", tags: [], cwd: root })];
  const options = { cwd: root, home: root, config: parsePrkConfig({ session: { workerTools: "direct" } }), historyDir: directory, model: "history-controlled/local", targets };
  const dependencies = { runtimeDependencies: { model: faux.getModel(), modelRuntime, thinkingLevel: "low", cwd: root, agentDir: root } };
  const startupReached = Promise.withResolvers();
  const continueStartup = Promise.withResolvers();
  dependencies.collectionFactory = (targets, options) => createSessionCollection(targets, { ...options, getRuntimeDependencies: async (...args) => { startupReached.resolve(); await continueStartup.promise; return options.getRuntimeDependencies(...args); } });
  host = await createGatewayHost(options, dependencies);
  await prepareGatewayEnvironment(host, root, "stable-target");
  const creating = host.createSession({ target: "stable-target" });
  void creating.catch(startupReached.reject);
  await bounded(startupReached.promise, "worker startup reached");
  try {
  const starting = host.workbench().sessions[0];
  assert.equal(starting.state, "starting");
  const rejectedStartingDelete = host.archiveSession(starting.sessionId, { confirm: true });
  const namedWhileStarting = host.renameSession(starting.sessionId, "Named while starting");
  await assert.rejects(rejectedStartingDelete, /starting|closing|changing/i);
  await namedWhileStarting;
  } finally { continueStartup.resolve(); }
  const empty = await creating;
  assert.equal(empty.session.label, "Named while starting");
  assert.equal(calls, 0, "Creating durable empty session does not call provider");
  // End it explicitly: a worker merely awake at shutdown would come back sleeping instead.
  await host.closeSession(empty.session.sessionId);
  await host.close();
  host = await createGatewayHost(options, dependencies);
  assert.equal(calls, 0);
  assert.deepEqual(await kernels(), baseline);
  assert.equal(host.workbench().sessions.find((worker) => worker.sessionId === empty.session.sessionId)?.state, "closed", "an ended worker stays closed across a restart");
  // An ended session has no runtime: input is refused at submission (only intentionally sleeping sessions wake).
  await assert.rejects(Promise.resolve().then(() => host.session(empty.session.sessionId).submit({ requestId: "archived-submit", message: "Do not run." })), /history|runtime|managed/i);

  const active = await host.createSession({ target: "stable-target" });
  const own = host.session(active.session.sessionId);
  const accepted = await own.submit({ requestId: "history-real-sdk", message: "Execute the controlled Python fixture once." });
  assert.equal(accepted.accepted, true);
  assert.equal((await bounded(accepted.completion, "controlled SDK operation")).status, "completed");
  ownedPids.add(Number(await readFile(workerPid, "utf8")));
  const count = calls;
  for (const file of await readdir(directory)) {
    const bytes = await readFile(join(directory, file), "utf8");
    for (const entry of bytes.trim().split("\n").map(JSON.parse).filter((entry) => entry.customType === "gateway-session-binding")) {
      assert.equal(entry.data.version, 4);
      assert.deepEqual(Object.keys(entry.data).sort(), ["cwd", "sessionId", "target", "version"], "PRK metadata stores only execution identity, never credentials");
    }
  }
  assert(host.history(active.session.sessionId).snapshot.messages.some((message) => message.role === "assistant"));
  const ending = host.closeSession(active.session.sessionId);
  await assert.rejects(host.archiveSession(active.session.sessionId, { confirm: true }), /starting|closing|changing/i);
  await ending;
  assert.deepEqual(await kernels(), baseline, "Ending frees only its owned kernel");
  // Archiving a live session closes it and hides it; its SDK file stays until purged.
  const doomed = await host.createSession({ target: "stable-target" });
  const filesBeforeDelete = (await SessionManager.list(root, directory)).length;
  await host.archiveSession(doomed.session.sessionId, { confirm: true });
  assert.deepEqual(await kernels(), baseline, "Archiving releases the session's kernel");
  assert(!host.workbench().sessions.some(({ sessionId }) => sessionId === doomed.session.sessionId), "Archived session leaves the live list");
  assert(host.workbench().archive.some(({ group }) => group === doomed.session.sessionId), "Archived session is in the archive");
  assert.equal((await SessionManager.list(root, directory)).length, filesBeforeDelete, "The archive keeps the SDK file");
  await host.purgeArchive(doomed.session.sessionId, { confirm: true });
  assert.equal((await SessionManager.list(root, directory)).length, filesBeforeDelete - 1, "Purge removes the SDK file");
  assert(host.history(active.session.sessionId).snapshot.messages.some((message) => message.role === "toolResult"));
  await host.renameSession(active.session.sessionId, "Saved calculation");
  await host.close();
  const freshConversation = await inspectInFreshGatewayProcess(root, directory, active.session.sessionId);
  assert.equal(freshConversation.snapshot.sessionId, active.snapshot.sessionId);
  assert.equal(freshConversation.session.label, "Saved calculation");
  assert(freshConversation.snapshot.messages.some((message) => message.role === "toolResult"));
  assert.deepEqual(await kernels(), baseline);

  host = await createGatewayHost({ ...options, model: "unavailable/offline", targets: [] });
  assert.equal(calls, count, "Browsing/restart does not invoke provider");
  endpoint = await startGateway(host, join(root, "history.sock"));
  client = await connectGateway(join(root, "history.sock"));
  const outside = join(root, "outside.jsonl");
  await writeFile(outside, "sentinel bytes\n");
  await assert.rejects(host.archiveSession(outside, { confirm: true }));
  assert.equal(await readFile(outside, "utf8"), "sentinel bytes\n");
  await client.request("archiveSession", { sessionId: active.session.sessionId, confirm: true });
  assert(!host.workbench().sessions.some(({ sessionId }) => sessionId === active.session.sessionId));
  assert.equal(host.history(active.session.sessionId).readOnly, true, "Archived history remains read-only without unarchiving");
  assert(host.history(empty.session.sessionId), "Archiving one session retains unrelated owned history");
  assert.deepEqual(await kernels(), baseline);
  const sentinelResult = await sentinel.tool.execute("sentinel-read", { code: "print(history_sentinel)" }, signal);
  assert(JSON.stringify(sentinelResult).includes("73"));
  assert.equal(calls, count);
  console.log("PASS gateway history: startup race, real SDK/Python history across process restart without replay, credential redaction, owned kernel closure, archiving/purge and unrelated sentinel retention");
});
