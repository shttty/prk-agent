import assert from "node:assert/strict";
import { createSession } from "./create-session.mjs";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../../../src/kernel/kernel-options.ts";

export async function checkPythonModeMatrix(target) {
  let defaultCellMode = "isolated";
  const f = await createSession(target, { hooks: {
    executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, defaultCellMode }),
  } });
  const run = async (mode, value, code, args) => {
    const reply = await f.run(code, args);
    assert.equal(reply.result.isError, false, reply.text);
    assert.equal(reply.result.details.mode, mode, code);
    assert.equal(reply.text.split("\n")[0], String(value), code);
  };
  try {
    await run("async", 41, `import asyncio, threading
mode_async_loop = asyncio.get_running_loop()
answer = await asyncio.sleep(0, result=41)
answer`);
    const kernelId = f.owner.getSnapshot().kernelId;
    await run("async", 42, "assert asyncio.get_running_loop() is not None\nawait asyncio.sleep(0, result=answer + 1)");
    await run("async", 43, `from contextlib import asynccontextmanager
@asynccontextmanager
async def managed():
    yield 41
async def values():
    yield 2
async with managed() as number:
    async for delta in values():
        number += delta
number`);
    await run("thread", 44, `mode_worker = threading.current_thread()
mode_worker_loop = asyncio.get_running_loop()
assert mode_worker is not threading.main_thread()
assert mode_worker_loop is not mode_async_loop
async def verify_worker():
    assert threading.current_thread() is mode_worker
    assert asyncio.get_running_loop() is mode_worker_loop
    return 44
await asyncio.sleep(0)
await verify_worker()`, { mode: "thread" });

    defaultCellMode = "thread";
    await run("thread", 45, `# await asyncio.sleep(0)
assert mode_worker_loop.is_closed()
assert not mode_worker.is_alive()
assert threading.current_thread() is not threading.main_thread()
assert threading.current_thread() is not mode_worker
assert 'await' in 'await asyncio.sleep(0)'
async def merely_define():
    return await asyncio.sleep(0)
def enclosing():
    async def nested():
        return await asyncio.sleep(0)
    return nested
45`);
    await run("async", 46, "assert asyncio.get_running_loop() is not mode_worker_loop\n46", { mode: "async" });
    defaultCellMode = "async";
    await run("async", 47, "assert asyncio.get_running_loop() is not mode_worker_loop\n47");

    await run("isolated", "Return (int): 48", `import asyncio
global isolated_was_run
isolated_was_run = True
return await asyncio.sleep(0, result=48)`, { mode: "isolated" });
    defaultCellMode = "isolated";
    await run("isolated", "Return (int): 49", "if True:\n    return 49");

    let opens = 0;
    const owned = { beforeYield: () => { opens++; } };
    const refused = (code, mode) => f.owner.executeOwned(owned, "before-admission", { code, yield_s: 0, ...mode });
    const invalid = await refused("invalid_was_run = True\nreturn await asyncio.sleep(0, result=49)");
    assert.equal(invalid.isError, true);
    assert.equal(invalid.details.mode, undefined, "implicit top-level await picks shared async, where return is invalid");
    assert.match(invalid.content[0].text, /SyntaxError/);
    assert.equal(opens, 0, "invalid shared source must not write an open");
    await run("thread", 50, `assert 'isolated_was_run' not in globals()
assert 'invalid_was_run' not in globals()
assert answer == 41
50`, { mode: "thread" });
    assert.equal(f.owner.getSnapshot().kernelId, kernelId, "isolated runs and invalid shared source preserve the generation");
    const version = await f.run("import sys\nprint(sys.version.split()[0])", { mode: "thread" });
    assert.equal(version.result.isError, false, version.text);
    assert.match(version.text, /^\d+\.\d+\.\d+/);
    console.log(`PASS real Python mode/admission matrix (${version.text.split("\n")[0]})`);
  } finally { await f.close(); }
}
