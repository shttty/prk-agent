import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

await withTargetFixture(async (target) => {
  const { tempRoot, runtime } = target;
  const prk = join(tempRoot, "prk"), agentDir = join(prk, "agent");
  Object.assign(process.env, { HOME: tempRoot, PRK_HOME: prk, TMPDIR: tempRoot, XDG_RUNTIME_DIR: tempRoot,
    PI_CODING_AGENT_DIR: agentDir, PRK_CODING_AGENT_DIR: agentDir });
  const { SessionManager } = await import("@earendil-works/pi-coding-agent");
  const { createYieldedSdkCell, text, until, within } = await import("./fixtures/create-yielded-sdk-cell.mjs");
  const manager = SessionManager.create(tempRoot, join(tempRoot, "history"));
  const f = await createYieldedSdkCell(target, { sessionManager: manager });
  const kernelId = f.owner.getSnapshot().kernelId;
  const opens = () => manager.getBranch().filter(({ customType }) => customType === "kernel-cell-open");
  const receipts = () => manager.getBranch().filter(({ customType }) => customType === "kernel-cell-result");
  const settled = async (run) => {
    assert.equal((await within(run.completion, `SDK operation ${run.id}`)).status, "completed");
    const result = f.parent(run.id);
    assert(result, `SDK tool result ${run.id}`);
    return result;
  };
  const runCode = async (code, args) => settled(await f.start(code, { yield_s: 60, ...args }));
  const shared = async (code) => {
    const result = await runCode(code, { mode: "thread" });
    assert.equal(result.isError, false, text(result));
    assert.equal(result.details.kernelId, kernelId);
  };
  const read = async (cell_id) => settled(await f.start({ cell_id }, { tool: "kernel_read" }));
  const assertReturn = (result, line) => {
    assert.equal(result.isError, false, text(result));
    assert.equal(result.details.mode, "isolated");
    assert.equal(result.details.kernelId, kernelId);
    assert.equal(text(result).split("\n")[0], line);
  };

  await shared(`left = right = [20]
shared_only = 'parent'
unpicklable = lambda: None`);
  assertReturn(await runCode(`import asyncio
assert 'shared_only' not in globals()
return await asyncio.sleep(0, result=42)`, { mode: "isolated" }), "Return (int): 42");

  const rejected = await settled(await f.start("raise AssertionError('rejected body ran')", { mode: "isolated", inputs: ["unpicklable"] }));
  assert.equal(rejected.isError, true, text(rejected));
  assert.match(text(rejected), /pickle|serializ/i);
  assert.deepEqual(f.owner.getSnapshot().activeCells, [], "unpicklable input did not return running");
  assert.deepEqual(opens(), [], "unpicklable input did not append a native open");
  assert.deepEqual(receipts(), []);

  const entered = f.path("isolated-body-entered"), release = f.path("complete-isolated-cell");
  const run = await f.start(`import asyncio
from pathlib import Path
assert 'shared_only' not in globals()
assert left is right
left.append(22)
global isolated_only
isolated_only = 'child'
Path(${JSON.stringify(entered)}).touch()
async def wait_for_release():
    while not Path(${JSON.stringify(release)}).exists():
        await asyncio.sleep(0.005)
await asyncio.wait_for(wait_for_release(), timeout=15)
assert gateway.late_probe() == 'HOOK_REWRITTEN'
for name, args, reasons in (
    ('kernel_read', {'cell_id': 'not-a-real-cell'}, ('not found', 'no callable', 'not callable')),
    ('prk_library_access', {}, ('prelude-only',)),
):
    try:
        gateway.call(name, args)
    except Exception as error:
        assert any(reason in str(error).lower() for reason in reasons), str(error)
    else:
        raise AssertionError(name + ' bypassed the callback rules')
return [left, right]`, { mode: "isolated", inputs: ["left", "right"], outputs: "bound_value" });
  let cell, parent;
  try {
    ({ cell, result: parent } = await f.running(run));
    assert.equal(cell.kernelId, kernelId);
    await settled(run);
    await until(() => f.exists(entered), "isolated body did not reach its await gate");
    assert.deepEqual(opens().map(({ data }) => [data.sessionId, data.kernelId, data.cellId, data.toolCallId]),
      [[manager.getSessionId(), kernelId, cell.cellId, run.id]]);
    assert.deepEqual(receipts(), [], "the live cell has no terminal receipt");
    const live = JSON.parse(text(await read(cell.cellId)));
    assert.deepEqual([live.status, live.cell_id], ["running", cell.cellId]);
    assert.doesNotMatch(live.output, /Return \(/);
    await shared("assert left is right and left == [20]\nassert 'bound_value' not in globals()\nassert 'isolated_only' not in globals()");
  } finally { await f.release(release); }

  await until(() => f.nativeEvents(cell.cellId, "finished").length === 1 && f.host.isIdle && f.session.isIdle
    && !f.owner.hasInFlightCell(), "isolated finish was not delivered and released after native result settlement");
  assert.equal(f.nativeEvents(cell.cellId, "finished")[0].details.outcome, "ok");
  const nested = f.hooks.filter(({ parentToolCallId }) => parentToolCallId === run.id);
  assert.deepEqual(nested.map(({ phase, toolName }) => [phase, toolName]), [["call", "late_probe"], ["result", "late_probe"]]);
  assert(nested.every(({ afterEnd }) => afterEnd), "the legal callback used the original SDK parent after yield");
  await shared(`assert bound_value == [[20, 22], [20, 22]]
assert bound_value[0] is bound_value[1] and bound_value[0] is not left
assert left is right and left == [20] and shared_only == 'parent'
assert 'isolated_only' not in globals()`);
  const returned = await read(cell.cellId);
  assertReturn(returned, "Return (list): [[20, 22], [20, 22]]");
  assert.equal(receipts().length, 1);
  const receipt = receipts()[0];
  assert.equal(receipt.data.cellId, cell.cellId);
  assert.deepEqual(returned.content, receipt.data.result.content);
  assert.deepEqual(returned.details, receipt.data.result.details);
  await shared("bound_value = saved_binding = ['manual overwrite']");
  const reread = await read(cell.cellId);
  assert.deepEqual(reread.content, returned.content);
  assert.deepEqual(reread.details, returned.details);
  assert.deepEqual(receipts(), [receipt], "kernel_read does not append another receipt");
  assert.deepEqual(f.parent(run.id), parent, "reads and late callbacks do not rewrite the original SDK parent");
  const stillOverwritten = "assert bound_value is saved_binding and bound_value == ['manual overwrite']";
  await shared(stillOverwritten);

  const overBudget = runtime.processWindow.maxBytes + 1;
  for (const [code, reason] of [["return lambda: None", /pickle|serializ/i], [`return bytes(${overBudget})`, /budget|limit|exceed/i]]) {
    const result = await runCode(code, { mode: "isolated", outputs: "bound_value" });
    assert.equal(result.isError, true, text(result));
    assert.equal(result.details.mode, "isolated");
    assert.match(text(result), reason);
    await shared(stillOverwritten);
  }
  assert.deepEqual(f.errors, []);
  await checkPreflight(target, { exists: f.exists, until, overBudget });
  console.log("PASS owned SDK/Python isolated values, native reads, and admission");
});

async function checkPreflight({ tempRoot, runtime, onCleanup }, { exists, until, overBudget }) {
  const { createPythonTool } = await import("../../src/kernel/assemble-kernel.ts");
  const { DEFAULT_KERNEL_EXECUTION_POLICY } = await import("../../src/kernel/kernel-options.ts");
  const forked = join(tempRoot, "fork-attempted"), loaded = join(tempRoot, "fork-preload-installed");
  const body = join(tempRoot, "rejected-body-ran");
  await writeFile(join(tempRoot, "isolated_fork_marker.py"), `import os
from pathlib import Path
os.register_at_fork(before=lambda: Path(${JSON.stringify(forked)}).touch())
Path(${JSON.stringify(loaded)}).write_text('ready', encoding='utf-8')
`);
  // Separate owner: no successful isolated execution can pre-create its at-fork marker.
  const owner = createPythonTool({ ...runtime, scoped: false }, { codeMode: true, environment: { PYTHONPATH: tempRoot },
    executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, defaultCellMode: "isolated", forkserverPreload: ["isolated_fork_marker"] }),
  });
  onCleanup(() => owner.close());
  await owner.ensure();
  const kernelId = owner.getSnapshot().kernelId;
  const seed = await owner.executeForeground("prepare-inputs", { mode: "thread", code: `import pickle
unpicklable = lambda: None
oversized = bytes(${overBudget})
class FailsRestore:
    def __reduce__(self):
        return (int, ('isolated restore sentinel',))
restore_fails = FailsRestore()
assert pickle.dumps(restore_fails)` });
  assert.equal(Boolean(seed.isError), false, seed.content[0].text);
  await until(() => exists(loaded), "forkserver did not install the at-fork marker");
  assert.equal(await readFile(loaded, "utf8"), "ready");
  let opens = 0;
  const beforeYield = () => { opens++; };
  const code = `from pathlib import Path\nPath(${JSON.stringify(body)}).touch()`;
  const reject = async (args, errorCode) => {
    await assert.rejects(owner.executeOwned({ beforeYield }, errorCode, { code, yield_s: 0, ...args }), { code: errorCode, submitted: false });
    assert.deepEqual(owner.getSnapshot().activeCells, []);
    assert.equal(opens, 0, "preflight rejection must not yield or append an open");
  };
  await reject({ mode: "thread", inputs: [] }, "INVALID_REQUEST");
  await reject({ code: `import asyncio\nawait asyncio.sleep(0)\n${code}`, outputs: "binding" }, "INVALID_REQUEST");
  await reject({ mode: "isolated", inputs: ["missing_name"] }, "INVALID_REQUEST");
  await reject({ mode: "isolated", inputs: ["not-an-identifier"] }, "INVALID_REQUEST");
  await reject({ mode: "isolated", outputs: "class" }, "INVALID_REQUEST");
  await reject({ mode: "isolated", inputs: ["unpicklable"] }, "ISOLATED_INPUT");
  await reject({ mode: "isolated", inputs: ["oversized"] }, "ISOLATED_INPUT");
  assert.equal(await exists(forked), false, "pre-fork validation never asked the owned forkserver to fork");
  assert.equal(await exists(body), false, "rejected cells did not execute");

  await reject({ mode: "isolated", inputs: ["restore_fails"] }, "ISOLATED_INPUT");
  assert.equal(await exists(forked), true, "the preload witnesses a real fork when restore is attempted");
  assert.equal(await exists(body), false, "failed restore did not enter the child body");
  assert.equal(owner.getSnapshot().kernelId, kernelId);
}
