import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

await withTargetFixture(async ({ tempRoot, runtime, onCleanup }) => {
  const prk = join(tempRoot, "prk");
  const environment = { HOME: tempRoot, PRK_HOME: prk, TMPDIR: tempRoot, XDG_RUNTIME_DIR: tempRoot, PYTHONPATH: tempRoot,
    PI_CODING_AGENT_DIR: join(prk, "agent"), PRK_CODING_AGENT_DIR: join(prk, "agent") };
  Object.assign(process.env, environment);
  const { createPythonTool } = await import("../../src/kernel/assemble-kernel.ts");
  const { DEFAULT_KERNEL_EXECUTION_POLICY } = await import("../../src/kernel/kernel-options.ts");
  const { text, until, within } = await import("./fixtures/create-yielded-sdk-cell.mjs");
  const decoding = join(tempRoot, "decoding"), release = join(tempRoot, "release");
  await writeFile(join(tempRoot, "isolated_stop_value.py"), `from pathlib import Path
import time

def restore():
    Path(${JSON.stringify(decoding)}).touch()
    for _ in range(2000):
        if Path(${JSON.stringify(release)}).exists():
            return 1234
        time.sleep(.005)
    raise RuntimeError('late-return fixture did not release')

class Returned:
    def __reduce__(self):
        return restore, ()
`);
  const owner = createPythonTool({ ...runtime, scoped: false }, {
    codeMode: true, environment,
    executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, interruptTimeoutMs: 1200 }),
  });
  onCleanup(() => owner.close());
  const finished = [];
  const unsubscribe = owner.subscribeFinished((entry) => finished.push(entry));
  onCleanup(() => { unsubscribe(); finished.forEach((entry) => entry.release()); });
  await within(owner.executeForeground("seed binding", { code: "binding = sentinel = [41]" }), "seed binding");
  const running = await within(owner.tool.execute("return after stop", { mode: "isolated", yield_s: 0, outputs: "binding",
    code: "from isolated_stop_value import Returned\nreturn Returned()" }), "late-return cell yielded");
  const { cell_id: cellId } = JSON.parse(text(running));
  try {
    // Restore runs only in the main interpreter and only after the real child has exited.
    await until(() => existsSync(decoding), "isolated child exited, runner is decoding the return");
    assert.equal((await owner.requestCellInterrupt(cellId, "auto")).status, "requested");
    await until(() => owner.previewCell(cellId)?.stopping?.blockedAt.some(({ step, status }) => step === "isolated" && status === "reaped"),
      "forkserver matched the exited-but-uncommitted cell");
  } finally { await writeFile(release, ""); }
  const result = await until(() => finished.find((entry) => entry.cellId === cellId)?.result, "cancelled decode settled");
  assert.equal(result.details.outcome, "aborted");
  assert.doesNotMatch(text(result), /Return \(/);
  const retained = await within(owner.executeForeground("check binding", {
    code: "assert binding is sentinel and binding == [41]",
  }), "check original binding");
  assert.equal(retained.details.outcome, "ok", text(retained));
  assert.equal(retained.details.kernelId, running.details.kernelId);
  console.log("PASS isolated late return: cancelled during parent decode, no value publication or binding");

  const held = join(tempRoot, "held"), closeOutput = join(tempRoot, "close-output");
  const heldRun = await within(owner.tool.execute("held output", { mode: "isolated", yield_s: 0, code: `
import os, time
from pathlib import Path
if os.fork() == 0:
    os.setsid()  # Outside the owned group, but still holding the inherited data endpoint.
    try:
        Path(${JSON.stringify(held)}).touch()
        for _ in range(2000):
            if Path(${JSON.stringify(closeOutput)}).exists():
                break
            time.sleep(.005)
    finally:
        os._exit(0)
print('owned output before EOF')
time.sleep(30)` }), "held-output cell yielded");
  const { cell_id: heldId } = JSON.parse(text(heldRun));
  try {
    await until(() => existsSync(held) && owner.previewCell(heldId)?.output.includes("owned output before EOF"),
      "detached process holds an endpoint with owned output");
    assert.equal((await owner.requestCellInterrupt(heldId, "auto")).status, "requested");
    const pending = await until(() => {
      const current = owner.previewCell(heldId)?.stopping;
      if (current?.cleanup === "unconfirmed") return current;
    }, "cleanup is unconfirmed while the output endpoint is held");
    assert(pending.blockedAt.some(({ step, status }) => step === "isolated" && status === "reaped"));
    assert(finished.every((entry) => entry.cellId !== heldId));
    assert.equal(owner.getSnapshot().kernelId, running.details.kernelId);
    assert.equal(owner.getSnapshot().connectionStatus, "connected");
  } finally { await writeFile(closeOutput, ""); }
  const drained = await until(() => finished.find((entry) => entry.cellId === heldId)?.result, "owned output received real EOF");
  assert.equal(drained.details.outcome, "aborted");
  assert.match(text(drained), /owned output before EOF/);
  console.log("PASS isolated output drain: reaped leader does not finish until inherited socket EOF");
}, { tempParent: "/tmp" });
