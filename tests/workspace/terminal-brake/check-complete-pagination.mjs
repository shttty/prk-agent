import assert from "node:assert/strict";
import { readCommandPages } from "./read-command-pages.mjs";

export async function checkCompletePagination({ call }) {
  const output = Array.from({ length: 20 }, (_, index) => `页${String(index).padStart(2, "0")}:汉🙂\n`).join("");
  assert(Buffer.byteLength(output) < 512);
  const command = await call("terminal_textsend", { name: "complete", text: "for i in {0..19}; do printf '页%02d:汉🙂\\n' \"$i\"; done", yield_s: 3 });
  assert.equal(command.status, "done");
  assert.equal(command.exit_code, 0);
  assert.equal(command.total_bytes, Buffer.byteLength(output));
  await readCommandPages(call, command, output);
  const inside = await call("terminal_read", { name: "complete", command: command.command_id, offset: 1 });
  assert(inside.output.startsWith("00:汉🙂\n"), "a byte offset inside 页 advances to the next complete code point");
  assert.equal(inside.total_bytes, Buffer.byteLength(output));
}
