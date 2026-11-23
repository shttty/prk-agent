import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkResistantBrake({ call, transport, sessionId, tempRoot, until, notices }) {
  const script = join(tempRoot, "brake-resistant.py");
  const pidFile = join(tempRoot, "brake-resistant-pid");
  await writeFile(script, `import os, pathlib, signal, time
signal.signal(signal.SIGINT, signal.SIG_IGN)
pathlib.Path(${JSON.stringify(pidFile)}).write_text(str(os.getpid()))
print("RESISTANT:汉🙂\\n" * 200, flush=True)
time.sleep(30)
`);
  const started = await call("terminal_textsend", { name: "resistant", text: `python3 ${JSON.stringify(script)}`, quiet_notify: true, yield_s: 0 });
  const generation = transport.list(sessionId).terminals.find(({ name }) => name === "resistant").generation;
  const pid = Number(await until(() => readFile(pidFile, "utf8").catch(() => ""), Boolean, "resistant process starts"));
  const pending = await until(() => call("terminal_read", { name: "resistant", command: started.command_id }), (result) => result.truncated, "resistant command exceeds output limit", 2000);
  assert.equal(pending.status, "running", "an ignored C-c is not a completed command");
  const events = await until(() => notices, (items) => items.some((event) => event.kind === "done" && event.result.command_id === started.command_id), "output brake confirms old PTY termination and rebuilds", 8000);
  const done = events.find((event) => event.kind === "done" && event.result.command_id === started.command_id).result;
  assert.equal(done.status, "killed");
  assert.equal(done.exit_code, null, "confirmed terminal deletion has no fabricated process exit code");
  assert.equal(done.truncated, true);
  assert.match(done.note ?? "", /commandOutputLimitBytes/u);
  assert.notEqual(transport.list(sessionId).terminals.find(({ name }) => name === "resistant").generation, generation);
  assert.throws(() => process.kill(pid, 0), (error) => error.code === "ESRCH", "the replaced terminal's real process has ended");
  assert.equal((await call("terminal_list")).terminals.find(({ name }) => name === "resistant").owner, "model");
  assert.deepEqual(await call("terminal_set", { name: "resistant" }), { name: "resistant", quiet_notify: true, output_brake: true }, "rebuilding preserves the terminal's notification and brake settings");
  const after = await call("terminal_textsend", { name: "resistant", text: "printf 'REBUILT\\n'", yield_s: 3 });
  assert.equal(after.status, "done");
  assert.equal(after.exit_code, 0);
  assert.equal(after.output, "REBUILT\n", "the rebuilt terminal is usable");
}
