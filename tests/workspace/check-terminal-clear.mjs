import assert from "node:assert/strict";
import { withTerminalFixture } from "./model-terminals/with-terminal-fixture.mjs";

await withTerminalFixture(async ({ call }) => {
  const previousOutput = "previous:旧🙂\n";
  const previous = await call("terminal_textsend", { text: "printf 'previous:旧🙂\\n'", yield_s: 3 });
  assert.equal(previous.status, "done");
  assert.equal(previous.output, previousOutput);

  const sections = ["before", "mid", "after"];
  const expected = sections.map((section) => Array.from({ length: 2000 }, (_, index) => `${section}-${index}:汉字🙂\n`).join("")).join("");
  // Clear moves the cursor home as well as erasing the display and scrollback.
  const clear = 'printf "\\e[2J\\e[3J"; printf "\\e[H"';
  const text = sections.map((section) => `for i in {0..1999}; do printf '${section}-%s:汉字🙂\\n' "$i"; done`).join(`; ${clear}; `);
  const command = await call("terminal_textsend", { text, yield_s: 10 });
  assert.equal(command.status, "done");
  assert.equal(command.exit_code, 0);
  assert.equal(command.command, text);
  assert.notEqual(command.command_id, previous.command_id);

  const expectedBytes = Buffer.from(expected);
  let full = "";
  let pages = 0;
  for (let offset = 0; offset < expectedBytes.length;) {
    const page = await call("terminal_read", { command: command.command_id, offset });
    const bytes = Buffer.from(page.output);
    assert.equal(page.status, "done");
    assert.equal(page.total_bytes, expectedBytes.length, "mid-command clear retains the complete output byte count");
    assert(bytes.length > 0 && bytes.length <= 50_000, "UTF-8 pages make bounded byte progress");
    assert.deepEqual(bytes, expectedBytes.subarray(offset, offset + bytes.length), "each page retains before/mid/after output at its original byte offset");
    assert(!page.output.includes("\ufffd"), "paging never splits a Unicode code point");
    full += page.output;
    offset += bytes.length;
    assert.equal(page.truncated, offset < expectedBytes.length);
    pages++;
  }
  assert(pages >= 3, "the cleared command spans multiple UTF-8 pages");
  assert.equal(full, expected, "both clear sequences preserve every command output line");

  const insideHan = await call("terminal_read", { command: command.command_id, offset: 10 });
  assert(insideHan.output.startsWith("字🙂\nbefore-1:汉字🙂\n"), "a byte offset inside 汉 advances to the next whole character");
  assert.deepEqual(Buffer.from(insideHan.output), expectedBytes.subarray(12, 12 + Buffer.byteLength(insideHan.output)));
  assert.equal(insideHan.total_bytes, expectedBytes.length);

  const retained = await call("terminal_read", { command: previous.command_id });
  assert.equal(retained.output, previousOutput, "clear in a later command does not change an earlier command");
  assert.equal(retained.total_bytes, Buffer.byteLength(previousOutput));
  assert.equal(retained.truncated, false);
  console.log("PASS headless terminal clear: full command output, exact UTF-8 paging and previous command retained");
});
