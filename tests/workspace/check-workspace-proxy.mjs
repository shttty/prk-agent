import { checkTerminalTransport } from "./proxy/check-terminal-transport.mjs";
import { checkWorkspaceFiles } from "./proxy/check-files.mjs";
import { createWorkspaceOwner } from "./proxy/create-owner.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { WebSocket } from "ws";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) throw new Error("Workspace check requires a test-owned Jupyter Server.");
// This test owns the server: avoid ambient shell first-run/onboarding prompts.
process.env.SHELL = "/bin/sh";

await withTargetFixture(async ({ config: target, tempRoot, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "prk-workspace-"));
  initializePrkHome(root);
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { connectWebGateway } = await import("../../src/http/gateway-connection/connect-gateway.ts");
  const { startWebServer } = await import("../../src/http/listener/start-listener.ts");
  const cwd = join(tempRoot, "work");
  await mkdir(cwd);
  let owner, adapter, web, client;
  const owners = [];
  const subscriptions = [];
  onCleanup(async () => {
    for (const subscription of subscriptions) subscription.close();
    const outcomes = await Promise.allSettled([web?.close(), adapter?.close(), ...owners.map((process) => process.stop())]);
    await rm(root, { recursive: true, force: true });
    const failures = outcomes.filter((outcome) => outcome.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map((outcome) => outcome.reason), "Workspace fixture cleanup failed");
  });
  const prkConfig = {
    workspace: { fileReadBytes: 128, terminalReplayBytes: 1024, terminalsPerWorkerMax: 2 },
  };
  const instancesDocument = { instances: [{ id: "owned", label: "Owned fixture", url: target.url, token: target.token, cwd, kernel: target.kernelOptions }] };
  const options = parsePrkConfig(prkConfig, instancesDocument);
  for (const key of ["fileReadBytes", "terminalReplayBytes", "terminalsPerWorkerMax"]) {
    assert.throws(() => parsePrkConfig({ workspace: { [key]: 0 } }));
  }
  assert.throws(() => parsePrkConfig({ workspace: { unknown: 1 } }));
  const socket = join(root, "gateway.sock");
  function deadline(promise, label) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 60000);
    })]).finally(() => clearTimeout(timer));
  }
  async function startOwner() {
    ({ owner, client, adapter, web } = await createWorkspaceOwner({ root, owners, target, deadline, socket, prkConfig, instancesDocument, options, connectGateway, connectWebGateway, startWebServer }));
  }
  async function stopOwner(crash = false) {
    for (const subscription of subscriptions) subscription.close();
    await Promise.all(subscriptions.map((subscription) => subscription.read));
    await web.close();
    await adapter.close();
    await owner.stop(crash);
    // A SIGKILL leaves our socket path; the owned child exit is confirmed above.
    if (crash) await rm(socket, { force: true });
  }
  await startOwner();
  const worker = (await client.request("createSession", { target: "owned" })).session.sessionId;
  const api = (name, suffix) => `${web.url}/api/sessions/${name}/${suffix}`;
  async function post(name, suffix, body, status = 200) {
    const response = await fetch(api(name, suffix), { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify(body) });
    const value = await response.json();
    assert.equal(response.status, status, JSON.stringify(value));
    assert(!JSON.stringify(value).includes(target.token), "Jupyter credentials never reach browser responses");
    return value;
  }
await checkWorkspaceFiles({ sessionId: worker, post, cwd, api });
  const socketUrl = (name, terminal) => `${web.url.replace("http:", "ws:")}/api/sessions/${name}/terminals/${terminal}/ws`;
  // A browser terminal socket: frames are JSON, `type()` is the keystroke path.
  function connect(name, terminal = "shell") {
    const ws = new WebSocket(socketUrl(name, terminal), { headers: { Origin: web.url } });
    const frames = [];
    const subscription = {
      frames, ws, code: undefined,
      read: new Promise((resolve) => ws.on("close", (code) => { subscription.code = code; resolve(); })),
      send: (frame) => ws.send(JSON.stringify(frame)),
      type: (data) => ws.send(JSON.stringify({ type: "input", data })),
      close: () => ws.terminate(),
      output: () => stripVTControlCharacters(frames.filter((frame) => frame.type === "stdout").map((frame) => frame.data).join("")).replaceAll("\r", ""),
    };
    ws.on("message", (raw) => frames.push({ ...JSON.parse(raw.toString()), at: Date.now() }));
    ws.on("error", () => {});
    subscriptions.push(subscription);
    return subscription;
  }
  async function until(predicate, label) {
    const deadline = Date.now() + 10000;
    while (!await predicate()) {
      if (Date.now() >= deadline) throw new Error(`Timed out: ${label}; terminal frames: ${JSON.stringify(subscriptions.map((stream) => stream.frames)).replaceAll(target.token, "<REDACTED>")}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  async function attached(socket, label) {
    await until(() => socket.frames.some((frame) => frame.type === "snapshot"), label);
    return socket.frames.find((frame) => frame.type === "snapshot");
  }
  async function refused(name, terminal, code, label) {
    const socket = connect(name, terminal);
    await socket.read;
    assert.equal(socket.code, 4000, `${label}: final close code, the browser must not reconnect`);
    assert.equal(socket.frames.find((frame) => frame.type === "error")?.code, code, label);
    assert(!socket.frames.some((frame) => frame.type === "snapshot"), `${label}: never attached`);
  }

let reattached = await checkTerminalTransport({ sessionId: worker, post, socketUrl, connect, attached, until, cwd, client, options, api });
  async function upstreamTerminals(path = "api/terminals", method = "GET") {
    const response = await fetch(new URL(path, target.url), { method, headers: { Authorization: `token ${target.token}` }, signal: AbortSignal.timeout(10000) });
    assert(response.ok, `Owned Jupyter ${method} terminals request: ${response.status}`);
    // The monitor's hidden collector terminal (prkmon_*) is not a user terminal; tests/monitor/check-monitor-real.mjs owns it.
    if (response.status === 204) return undefined;
    const body = await response.json();
    return Array.isArray(body) ? body.filter((terminal) => !terminal.name.startsWith("prkmon_")) : body;
  }
  const beforeOther = new Set((await upstreamTerminals()).map((terminal) => terminal.name));
  const other = connect(worker, "other");
  await attached(other, "other terminal snapshot");
  const otherUpstream = (await upstreamTerminals()).filter((terminal) => !beforeOther.has(terminal.name));
  assert.equal(otherUpstream.length, 1, "Opening other creates one real upstream terminal");
  await refused(worker, "over-limit", "BUSY", "the per-worker terminal limit is final, not waited out");
  const list = await (await fetch(api(worker, "terminals"))).json();
  assert.deepEqual(list.terminals.map((terminal) => terminal.name).sort(), ["other", "shell"]);
  const marker = `PERSIST_${randomUUID().replaceAll("-", "")}`;
  reattached.type(`printf '%s:%s\\n' '${marker}' "$$"\r`);
  await until(() => new RegExp(`\\n${marker}:(\\d+)\\n`).test(reattached.output()), "unique marker and original shell PID");
  const shellPid = new RegExp(`\\n${marker}:(\\d+)\\n`).exec(reattached.output())[1];
  let replayMarker = marker;
  await stopOwner();
  assert((await upstreamTerminals()).some((terminal) => beforeOther.has(terminal.name)), "Graceful Gateway shutdown preserves upstream shell");
  await upstreamTerminals(`api/terminals/${encodeURIComponent(otherUpstream[0].name)}`, "DELETE");
  await startOwner();
  const afterRestart = await (await fetch(api(worker, "terminals"))).json();
  assert.deepEqual(afterRestart.terminals.map((terminal) => terminal.name), ["shell"], "Restart drops the terminal deleted out of band");
  async function assertAdopted(label) {
    reattached = connect(worker);
    const recentOutput = () => stripVTControlCharacters(reattached.frames.filter((frame) => frame.type === "snapshot").map((frame) => frame.replay).join("")).replaceAll("\r", "") + reattached.output();
    await until(() => recentOutput().includes(`\n${replayMarker}:${shellPid}\n`), `${label} replays upstream recent output`);
    const executed = `${label}_${randomUUID().replaceAll("-", "")}`;
    reattached.type(`printf '%s:%s\\n' '${executed}' "$$"\r`);
    await until(() => new RegExp(`\\n${executed}:(\\d+)\\n`).test(reattached.output()), `${label} input executes`);
    assert.equal(new RegExp(`\\n${executed}:(\\d+)\\n`).exec(reattached.output())[1], shellPid, `${label} adopts the identical live shell process`);
    replayMarker = executed;
  }
  await assertAdopted("RESTART");
  await stopOwner(true);
  await startOwner();
  await assertAdopted("CRASH");

  // A session transition (waking the sleeping worker) is a transient BUSY: opening waits it out and attaches to the same
  // shell; listing and typing never wait.
  const waking = client.request("wakeSession", { sessionId: worker }).then(() => undefined, (error) => error);
  let woke = false;
  void waking.then(() => { woke = true; });
  let busy;
  await until(async () => {
    try { await client.request("terminalOpen", { sessionId: worker, name: "shell" }); return woke; } catch (error) { busy = error; return true; }
  }, "the wake is visible as a session transition");
  assert.equal(busy?.code, "BUSY");
  assert.equal(busy.details?.transient, true, "A session transition is marked retryable");
  const duringList = await (await fetch(api(worker, "terminals"))).json();
  assert.deepEqual(duringList.terminals.map((terminal) => terminal.name), ["shell"], "Listing is not held back by the transition");
  reattached.type("echo DURING_TRANSITION\r");
  await until(() => reattached.output().includes("\nDURING_TRANSITION\n"), "typing is not held back by the transition");
  const waiting = connect(worker);
  const waitingSnapshot = await attached(waiting, "terminal attaches once the session has settled");
  assert(!waiting.frames.some((frame) => frame.type === "error"), "No error was shown while waiting");
  assert.equal(await waking, undefined, "The wake itself succeeded");
  assert.equal(waitingSnapshot.connectionStatus, "connected");
  assert(waitingSnapshot.replay.includes("DURING_TRANSITION"), "The same shell is back with its recent output");

  const second = connect(worker, "other");
  await attached(second, "other terminal on the awake worker");
  await post(worker, "terminals/close", { name: "shell" });
  await until(() => reattached.frames.some((frame) => frame.type === "closed"), "explicit terminal close event");
  await reattached.read;
  assert.equal(reattached.code, 4000, "A closed terminal ends its socket for good");
  await client.request("closeSession", { sessionId: worker });
  assert.deepEqual(await upstreamTerminals(), [], "Explicit worker close terminates its remaining owned terminals");
  await refused(worker, "after-close", "INVALID_REQUEST", "a closed worker is refused at once");
  await stopOwner();
  await startOwner();
  assert.deepEqual(await upstreamTerminals(), [], "Ended worker terminals do not reappear after restart");
  await refused(worker, "after-close", "INVALID_REQUEST", "a closed worker stays refused after restart");
  const orphan = (await client.request("createSession", { target: "owned" })).session.sessionId;
  await attached(connect(orphan, "orphan"), "orphan terminal snapshot");
  await stopOwner();
  const { createSessionHistory } = await import("../../src/sessions/history/assemble-history.ts");
  const retainedHistory = await createSessionHistory({ cwd: root, directory: join(root, "history"), limits: options.limits });
  await rm(retainedHistory.get(orphan).sessionFile);
  await startOwner();
  assert.deepEqual(await upstreamTerminals(), [], "Startup closes a retained upstream terminal whose native worker history was removed");
  await assert.rejects(readFile(join(root, "provider-calls")), (error) => error.code === "ENOENT", "No controlled provider/model requests were made");
  console.log("PASS workspace proxy: real Jupyter files + conflict + raw/base64 + size cap; terminal WebSocket: cwd/input/fanout/reattach/bounded Unicode replay/resize/ordered burst/10 KB paste/close/worker cleanup, malformed frames and foreign Origin refused, per-key POST and SSE gone; transient session transition waited out (list and typing unaffected), closed worker and terminal limit refused at once; real Gateway restart + SIGKILL adoption preserve shell PID/recent output/executing input; out-of-band upstream deletion drops owned name; private HTTP and main rejection; zero model requests");
});
