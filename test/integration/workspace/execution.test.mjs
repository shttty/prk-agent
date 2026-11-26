import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { gatewayFixture, text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";
import { verifyFileHelpers } from "../../fixtures/kernel/verify-file-helpers.mjs";

const call = (f, id, name, args) => f.send(id, `TOOL ${JSON.stringify({ name, args })}`);

test("awake /reload preserves the Python namespace, cells still interrupt by identity, and file helpers work on every kernel path", async (t) => {
  const f = await gatewayFixture(t);
  await f.stageArtifacts();
  const id = await f.create();
  await verifyFileHelpers(f, id, "first-cell.txt");
  const seed = await call(f, id, "kernel_code", { code: "seed = 41\nprint(seed)" });
  assert.equal((await f.complete(id, seed)).status, "completed");
  assert.match(text(f.state(id).messages.findLast((message) => message.role === "toolResult")), /41/);
  const awake = f.state(id);
  assert.equal(awake.state, "idle");
  assert.equal(awake.kernel?.state, "idle");
  assert(awake.kernel?.kernelId, "reload must start with a live Python generation");
  const reloaded = await f.send(id, "/reload");
  assert.equal(reloaded.status, "completed", JSON.stringify(reloaded));
  assert.equal(f.state(id).kernel?.kernelId, awake.kernel.kernelId);
  const apiReload = await f.request("nativeAction", { sessionId: id, requestId: crypto.randomUUID(), action: "reload", args: {} });
  assert.equal(apiReload.status, "completed", JSON.stringify(apiReload));
  assert.equal(f.state(id).kernel?.kernelId, awake.kernel.kernelId);
  const started = join(f.cwd, "started");
  const receipt = await call(f, id, "kernel_code", { code: `import asyncio\nfrom pathlib import Path\nPath(${JSON.stringify(started)}).touch()\nawait asyncio.sleep(60)\nprint('should not complete')`, yield_s: 0 });
  await until(() => access(started).then(() => true, () => false), "Python cell entered");
  const { kernelId, cellId } = await until(() => f.state(id).kernel.activeCells[0], "yielded cell identity");
  const interrupted = await f.request("kernelInterrupt", { sessionId: id, kernelId, cellId, cellOnly: true });
  assert.equal(interrupted.status, "requested");
  assert.equal((await f.complete(id, receipt)).status, "completed");
  const result = await until(() => f.state(id).kernelCells?.find((cell) => cell.cellId === cellId && cell.outcome), "stopped cell settlement");
  assert.equal(result.outcome, "aborted");
  assert.equal((await f.complete(id, await call(f, id, "kernel_code", { code: "print(seed + 1)" }))).status, "completed");
  assert.match(text(f.state(id).messages.findLast((message) => message.role === "toolResult")), /42/);
  await verifyFileHelpers(f, id, "later-cell.txt");

  const save = await call(f, id, "kernel_code", { code: 'print(gateway.memory(operations=[{"action":"add", "target":"user", "content":"Fixture entry"}])["message"])' });
  assert.equal((await f.complete(id, save)).status, "completed");
  assert.match(text(f.state(id).messages.findLast((message) => message.role === "toolResult")), /Saved; do not repeat this update/);
  const edited = await f.request("memoryChange", { operations: [
    { action: "replace", target: "user", old_text: "Fixture entry", content: "Updated fixture entry" },
  ] });
  assert.deepEqual(edited.memories.find((item) => item.target === "user").entries, ["Updated fixture entry"]);
  const beforeReset = f.state(id).kernel.kernelId;
  await verifyFileHelpers(f, id, "reset-cell.txt", { reset: true });
  assert.notEqual(f.state(id).kernel.kernelId, beforeReset);
});

test("model terminal foreground command settles with exit status, output and managed process attention", async (t) => {
  const f = await gatewayFixture(t, { config: { monitor: { enabled: true, fastIntervalMs: 500, slowIntervalMs: 500 }, session: { workerTools: "direct", capabilities: { "lazy:group:tools:package:<inline:terminals>": false } } } });
  await f.stageArtifacts();
  const id = await f.create();
  assert.equal((await f.complete(id, await call(f, id, "terminal_textsend", { text: "" }))).status, "completed");
  const setting = await call(f, id, "terminal_set", { quiet_notify: false, output_brake: false });
  assert.equal((await f.complete(id, setting)).status, "completed");
  const switched = f.state(id).messages.findLast((message) => message.role === "toolResult");
  assert.equal(switched.isError, false, text(switched));
  assert.deepEqual(JSON.parse(text(switched)), { name: "main", quiet_notify: false, output_brake: false });
  const receipt = await call(f, id, "terminal_textsend", { text: "printf 'verification-output\\n'; false", yield_s: 3 });
  assert.equal((await f.complete(id, receipt)).status, "completed");
  const result = f.state(id).messages.findLast((message) => message.role === "toolResult");
  assert.equal(result.isError, false, text(result));
  const settled = JSON.parse(text(result));
  assert.deepEqual([settled.status, settled.exit_code, settled.output.trim()], ["done", 1, "verification-output"]);
  assert.equal(f.state(id).terminals.some((terminal) => terminal.runningCommand), false);

  const long = await call(f, id, "terminal_textsend", { text: "sleep 20", yield_s: 0 });
  assert.equal((await f.complete(id, long)).status, "completed");
  const terminal = f.state(id).terminals.find((candidate) => candidate.runningCommand);
  assert(terminal);
  await until(async () => {
    const row = (await f.request("workbench", {})).sessions.find((session) => session.sessionId === id);
    return row.state === "idle" && row.background
      && row.monitor?.processes.some((proc) => proc.command === "sleep 20" && proc.ownership === "managed");
  }, "foreground PTY process and managed background attention", 5000);
  const { name, generation, runningCommand } = terminal;
  assert.equal((await f.request("terminalInterrupt", { sessionId: id, name, generation, commandId: runningCommand.id })).requested, true);
});


test("a subprocess that outlives its kernel cell appears as detached and clears the sidebar attention when it exits", async (t) => {
  const f = await gatewayFixture(t, { remote: true, config: { monitor: { enabled: true, fastIntervalMs: 500, slowIntervalMs: 500 } } });
  await f.stageArtifacts();
  const id = await f.create();
  const attention = [];
  const unsubscribe = f.client.onCollectionEvent((event) => {
    if (event.sessionId === id && event.type === "session_attention_changed") attention.push(event.details.background);
  });
  t.after(unsubscribe);
  await f.request("subscribeSessions");
  const row = async () => (await f.request("workbench", {})).sessions.find((session) => session.sessionId === id);
  const receipt = await call(f, id, "kernel_code", { code: `import subprocess
background_probe = subprocess.Popen(["sleep", "30"])
print(background_probe.pid)` });
  assert.equal((await f.complete(id, receipt)).status, "completed");
  const pid = Number(text(f.state(id).messages.findLast((message) => message.role === "toolResult")).match(/^([0-9]+)$/m)?.[1]);
  assert(pid > 0);
  const observed = await until(async () => {
    const value = await row();
    return value.monitor?.processes?.find((process) => process.pid === pid) && value;
  }, "target proc sample", 5000);
  assert.equal(observed.state, "idle");
  assert.equal(observed.background, true);
  assert.equal(observed.monitor.processes.find((process) => process.pid === pid).ownership, "detached");
  assert(attention.includes(true));
  const stop = await call(f, id, "kernel_code", { code: `background_probe.terminate()
background_probe.wait()` });
  assert.equal((await f.complete(id, stop)).status, "completed");
  await until(async () => {
    const value = await row();
    return value.monitor?.processes?.length && !value.monitor.processes.some((process) => process.pid === pid) && !value.background;
  }, "detached process removal and sidebar clear", 5000);
  assert.equal(attention.at(-1), false);
});
