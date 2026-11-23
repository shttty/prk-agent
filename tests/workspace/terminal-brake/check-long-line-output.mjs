import assert from "node:assert/strict";
import { readCommandPages } from "./read-command-pages.mjs";
import { writeOutputScript } from "./write-output-script.mjs";

export async function checkLongLineOutput({ call, tempRoot, notices }) {
  // This single logical line wraps past the entire 30-line headless scrollback.
  const payload = "L🙂汉" + Array.from({ length: 2000 }, (_, index) => `${String(index).padStart(4, "0")}汉🙂`).join("") + "尾🙂T";
  const head = "L🙂", tail = "🙂T";
  const discarded = Buffer.byteLength(payload) - Buffer.byteLength(head + tail);
  const expected = `${head}…[discarded ${discarded} bytes]…${tail}`;
  const script = await writeOutputScript(tempRoot, "long-line", payload);
  const done = await call("terminal_textsend", { name: "long-line", text: script.text, output_brake: false, yield_s: 5 });
  assert.equal(done.status, "done");
  assert.equal(done.exit_code, 0);
  assert.equal(done.truncated, true);
  await readCommandPages(call, done, expected, true);
  assert.equal(notices.filter((event) => event.kind === "warning" && event.result.command_id === done.command_id).length, 1, "softwrap-only output still warns exactly once");
}
