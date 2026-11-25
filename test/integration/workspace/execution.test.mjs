import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { gatewayFixture, text } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";

const call = (f, id, name, args) => f.send(id, `TOOL ${JSON.stringify({ name, args })}`);

test("awake /reload preserves the Python namespace and cells still interrupt by identity", async (t) => {
  const f = await gatewayFixture(t);
  await f.deploy();
  const id = await f.create();
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

  const save = await call(f, id, "kernel_code", { code: 'print(gateway.memory(operations=[{"action":"add", "target":"user", "content":"Fixture entry"}])["message"])' });
  assert.equal((await f.complete(id, save)).status, "completed");
  assert.match(text(f.state(id).messages.findLast((message) => message.role === "toolResult")), /Saved; do not repeat this update/);
  const edited = await f.request("memoryChange", { operations: [
    { action: "replace", target: "user", old_text: "Fixture entry", content: "Updated fixture entry" },
  ] });
  assert.deepEqual(edited.memories.find((item) => item.target === "user").entries, ["Updated fixture entry"]);
});

test("model terminal foreground command settles with exit status and output", async (t) => {
  const f = await gatewayFixture(t, { config: { session: { workerTools: "direct", capabilities: { "lazy:group:tools:package:<inline:terminals>": false } } } });
  await f.deploy();
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
});
