import assert from "node:assert/strict";
import test from "node:test";
import { toolDeclarations } from "../../../../src/sessions/runtime/tools/project-declarations.ts";
import { prepareDeclarations } from "../../../../src/sessions/runtime/tools/prepare-declarations.ts";
import { refreshToolDeclarations } from "../../../../src/sessions/runtime/tools/refresh-declarations.ts";
import { registerCellTools } from "../../../../src/plugins/kernel/register-cell-tools.ts";
import { renderKernel } from "../../../../src/plugins/kernel/prompt/kernel/render.ts";
import { createCell } from "../../../../src/kernel/cell/create-cell.ts";
import { requestCellInterrupt } from "../../../../src/kernel/process/request-cell-interrupt.ts";
import { createKernelWindow } from "../../../../src/kernel/protocol/assemble-kernel-window.ts";
import { publish } from "../../../../src/kernel/telemetry/publish.ts";
import { createKernelToolDefinition } from "../../../../src/plugins/kernel/create-kernel-tool-definition.ts";

const cellId = "01234567-89ab-4cde-8fab-0123456789ab";
const otherId = "11234567-89ab-4cde-8fab-0123456789ab";
const sourceInfo = { path: "<inline:kernel>", origin: "inline" };
const tool = (name) => ({ name, description: name, parameters: { type: "object" }, sourceInfo,
  exposure: name.startsWith("kernel_") ? "model-only" : "direct" });

test("Python tools disclose shared subprocess effects and only accept cell identity for stopping", () => {
  const tools = new Map();
  registerCellTools({ registerTool: (definition) => tools.set(definition.name, definition) }, {}, () => undefined);
  const interrupt = tools.get("kernel_interrupt");
  for (const definition of [interrupt, createKernelToolDefinition("test", true), createKernelToolDefinition("test", false)]) {
    assert.match(definition.description, /other cells using the same subprocess/i);
  }
  for (const field of ["pid", "pgid"]) {
    assert.throws(() => interrupt.prepareArguments({ cell_id: cellId, [field]: 42 }), { code: "INVALID_REQUEST" });
  }
});

test("global mode refreshes declarations in both tool modes without rebuilding library or registration", () => {
  for (const mode of ["direct", "code"]) {
    let asyncExecution = true;
    const tools = ["kernel_code", "kernel_read", "kernel_interrupt", "external"].map(tool);
    const loadouts = [];
    const session = { getAllTools: () => tools, getToolDefinition: () => undefined,
      setActiveToolsByName: (names) => loadouts.push({ names, hidden: prepareDeclarations(ctx, { declared: tools }).hiddenDeclarations }) };
    const ctx = { toolMode: mode, target: { id: "fixture", local: true }, dependencies: {}, sessionOptions: { capabilities: {} },
      capabilityOverrides: {}, nativeNames: new Set(), toolInventory: tools, callbackSession: session, active: { session },
      python: { asyncExecution: () => asyncExecution }, disposeLibrary: { refresh: () => assert.fail("Mode refresh must not rebuild the library") } };
    for (const enabled of [true, false, true]) {
      asyncExecution = enabled;
      refreshToolDeclarations(ctx);
      const declarations = toolDeclarations(ctx).declared;
      assert.equal(declarations.includes("kernel_read"), enabled);
      assert.equal(declarations.includes("kernel_interrupt"), enabled);
      assert(declarations.includes("kernel_code"));
      assert.equal(declarations.includes("external"), mode === "direct");
      assert.deepEqual(loadouts.at(-1).names, tools.map(({ name }) => name), "All model-only tools stay registered and active");
      for (const name of ["kernel_read", "kernel_interrupt"]) assert.equal(loadouts.at(-1).hidden.includes(name), !enabled);
    }
    assert.equal(session.getAllTools(), tools);
    assert.equal(loadouts.length, 3);
  }
});

test("disabled mode keeps only the active yielded cell readable and interruptible", async () => {
  let asyncExecution = false;
  const result = { content: [{ type: "text", text: "bounded output" }], details: {} };
  const calls = [], tools = new Map();
  const generation = "kernel-a";
  const ctx = {
    closed: false, cells: new Map(), listeners: new Set(), hooks: {}, runnerMaxActiveCells: 4,
    snapshot: { state: "busy", kernelId: generation, activeCells: [] },
    clock: { now: () => 0, schedule: () => () => {} },
    process: { generation, pgid: 42, retirement: new AbortController(), requestId: 1, pendingRequests: new Map(),
      window: createKernelWindow({ maxRequests: 5, maxBytes: 2 ** 21, maxFrameBytes: 2 ** 20 }, generation, 2 ** 16),
      process: { write: (line) => calls.push(["interrupt", JSON.parse(line)]) } },
  };
  const activeCell = createCell(ctx, { timeoutMs: 0, reminderLadderMs: [] });
  Object.assign(activeCell, { id: cellId, kernelId: generation, toolCallId: "tool-a", requestId: 1, yielded: true });
  ctx.cells.set(cellId, activeCell);
  publish(ctx, {});
  const client = {
    asyncExecution: () => asyncExecution,
    getSnapshot: () => ctx.snapshot,
    readCell: async (...args) => { calls.push(["read", ...args]); return result; },
    requestCellInterrupt: requestCellInterrupt.bind(null, ctx),
  };
  registerCellTools({ registerTool: (definition) => tools.set(definition.name, definition) }, client, () => undefined);
  const read = tools.get("kernel_read"), interrupt = tools.get("kernel_interrupt");
  assert.equal(read.exposure, "model-only");
  assert.equal(interrupt.exposure, "model-only");
  assert.equal(await read.execute("read-a", { cell_id: cellId }), result);
  const requested = await interrupt.execute("interrupt-a", { cell_id: cellId });
  assert.deepEqual(JSON.parse(requested.content[0].text), { status: "requested", cell_id: cellId, restart: "auto", grace_ms: 10_000, peers: [] });
  assert.deepEqual(calls[1], ["interrupt", { generation, id: 2, kind: "cancel", cellId }]);
  for (const definition of [read, interrupt]) await assert.rejects(definition.execute("stale", { cell_id: otherId }), { code: "NOT_FOUND" });
  assert.equal(calls.length, 2, "Unrelated IDs never reach read or interrupt");
  activeCell.resolve("aborted");
  ctx.cells.delete(cellId);
  publish(ctx, {});
  for (const definition of [read, interrupt]) await assert.rejects(definition.execute("completed", { cell_id: cellId }), { code: "NOT_FOUND" });
  assert.equal(calls.length, 2, "Completed IDs are stale when async execution is off");
  asyncExecution = true;
  assert.equal(await read.execute("re-enabled", { cell_id: cellId }), result);
});

test("an admitted read survives disable and completion without admitting another stale read", async () => {
  let asyncExecution = true;
  let activeCell = { kernelId: "kernel-a", cellId, toolCallId: "tool-a", startedAt: 1 };
  const pending = Promise.withResolvers();
  const tools = new Map();
  registerCellTools({ registerTool: (definition) => tools.set(definition.name, definition) }, {
    asyncExecution: () => asyncExecution, getSnapshot: () => ({ activeCells: activeCell ? [activeCell] : [] }), readCell: () => pending.promise,
  }, () => undefined);
  const read = tools.get("kernel_read");
  const inFlight = read.execute("read-a", { cell_id: cellId, yield_s: 30 });
  asyncExecution = false;
  activeCell = undefined;
  const completed = { content: [{ type: "text", text: "finished output" }], details: {} };
  pending.resolve(completed);
  assert.equal(await inFlight, completed);
  await assert.rejects(read.execute("stale", { cell_id: cellId }), { code: "NOT_FOUND" });
});

test("kernel prompt tracks current admission mode and keeps observation outside the busy kernel", () => {
  const input = { helpers: [], toolLibrary: false, autoTools: false, kernelCapabilities: () => false,
    capabilityEnabled: () => false, fileHelper: () => false, binaryPrompt: () => undefined };
  const asynchronous = renderKernel({ ...input, asyncExecution: true }, []);
  assert(asynchronous.includes("kernel_read and kernel_interrupt are model-only tools outside this busy kernel"));
  assert(asynchronous.includes("do not poll"));
  const synchronous = renderKernel({ ...input, asyncExecution: false }, []);
  assert(synchronous.includes("yield_s is ignored"));
  assert(synchronous.includes("Previously yielded cells keep their completion notifications"));
  assert(!synchronous.includes("may return running"));
});
