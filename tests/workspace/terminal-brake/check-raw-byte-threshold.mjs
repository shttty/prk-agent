import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readCommandPages } from "./read-command-pages.mjs";

export async function checkRawByteThreshold({ call, tempRoot, notices }) {
  const script = join(tempRoot, "raw-byte-threshold.py");
  await writeFile(script, `import sys, time
sys.stdout.write("\\x1b[31m\\x1b[0m" * 100)
sys.stdout.flush()
time.sleep(0.05)
sys.stdout.write("H🙂汉x\\n")
sys.stdout.flush()
`);
  const done = await call("terminal_textsend", { name: "raw-bytes", text: `python3 ${JSON.stringify(script)}`, output_brake: false, yield_s: 3 });
  assert.equal(done.status, "done");
  assert.equal(done.exit_code, 0);
  assert.equal(done.truncated, true, "raw PTY controls count toward the threshold even when normalized text is only ten bytes");
  await readCommandPages(call, done, "H🙂…[discarded 0 bytes]…汉x\n", true);
  assert.equal(notices.filter((event) => event.kind === "warning" && event.result.command_id === done.command_id).length, 1);
}
