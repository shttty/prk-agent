import assert from "node:assert/strict";
import { readCommandPages } from "./read-command-pages.mjs";
import { writeOutputScript } from "./write-output-script.mjs";

export async function checkHumanOutput({ call, transport, terminals, sessionId, config, tempRoot, notices, until }) {
  const name = "human-output";
  await transport.open(sessionId, config, name);
  assert.equal((await call("terminal_read", { name, raw: true })).integration, "ready");
  const payload = "H🙂汉:human\n" + Array.from({ length: 140 }, (_, index) => `human${String(index).padStart(3, "0")}:汉🙂\n`).join("") + "尾🙂T\n";
  const head = "H🙂", tail = "🙂T\n";
  const expected = `${head}…[discarded ${Buffer.byteLength(payload) - Buffer.byteLength(head + tail)} bytes]…${tail}`;
  const script = await writeOutputScript(tempRoot, name, payload);
  const start = notices.length;
  transport.input(sessionId, name, `${script.text}\r`);
  const done = await until(() => call("terminal_read", { name }), (result) => result.command_id !== null && result.status === "done" && result.total_bytes > 0, "human-typed output completes naturally", 5000);
  assert.equal(done.exit_code, 0, "human-typed commands are never automatically interrupted");
  assert.equal(done.truncated, true);
  await readCommandPages(call, done, expected, true);
  assert.deepEqual(notices.slice(start), [], "human transport.input sends no model warning, quiet or completion event");
  assert.equal(terminals.hasRunning(), false);
}
