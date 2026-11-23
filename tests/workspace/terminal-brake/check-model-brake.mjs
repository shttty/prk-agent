import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkModelBrake({ call, tempRoot, until, notices }) {
  const script = join(tempRoot, "brake-signal.py");
  const signaled = join(tempRoot, "brake-signaled");
  const release = join(tempRoot, "brake-release");
  const count = join(tempRoot, "brake-signal-count");
  await writeFile(script, `import pathlib, signal, sys, time
signals = 0
def interrupt(signum, frame):
    global signals
    signals += 1
signal.signal(signal.SIGINT, interrupt)
deadline = time.monotonic() + 4
while signals == 0 and time.monotonic() < deadline:
    print("STREAM:0123456789:汉🙂", flush=True)
    time.sleep(0.005)
if signals:
    for index in range(100):
        print("AFTER_INTERRUPT:%03d:汉🙂" % index, flush=True)
    pathlib.Path(${JSON.stringify(signaled)}).write_text(str(signals))
    deadline = time.monotonic() + 4
    while not pathlib.Path(${JSON.stringify(release)}).exists() and time.monotonic() < deadline:
        time.sleep(0.01)
pathlib.Path(${JSON.stringify(count)}).write_text(str(signals))
sys.exit(42 if signals == 1 else 43)
`);
  const started = await call("terminal_textsend", { name: "braked", text: `python3 ${JSON.stringify(script)}`, yield_s: 0 });
  assert.equal(started.status, "running");
  try {
    await until(() => readFile(signaled, "utf8").catch(() => ""), Boolean, "output brake delivers real SIGINT", 3000);
    const pending = await call("terminal_read", { name: "braked", command: started.command_id });
    assert.equal(pending.status, "running", "sending C-c alone must not claim the process has finished");
    assert.equal(pending.exit_code, null);
    assert.equal(pending.truncated, true);
    assert.match(pending.note ?? "", /commandOutputLimitBytes/u);
    assert.match(pending.note ?? "", /interrupt|中断|Ctrl-C|C-c/iu);
  } finally { await writeFile(release, "release"); }
  const done = await until(() => call("terminal_read", { name: "braked", command: started.command_id }), (result) => result.status !== "running", "signal-handling process actually exits", 3000);
  assert.equal(done.status, "done", "the brake preserves the command's real status, not a fabricated killed status");
  assert.equal(done.exit_code, 42, "the actual SIGINT handler determines the exit code");
  assert.equal(await readFile(count, "utf8"), "1", "continued post-limit output must not send another C-c");
  assert.equal(done.truncated, true);
  assert.match(done.note ?? "", /commandOutputLimitBytes/u);
  assert(notices.some((event) => event.kind === "done" && event.result.command_id === started.command_id && event.result.exit_code === 42));
  assert(!notices.some((event) => event.kind === "warning" && event.result.command_id === started.command_id), "braked model commands do not take the exemption-warning path");
}
