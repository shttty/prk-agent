import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { readCommandPages } from "./read-command-pages.mjs";
import { writeOutputScript } from "./write-output-script.mjs";

export async function checkExemptOutput({ call, tempRoot, until, notices }) {
  const payload = "H🙂汉:0123456789\n" + Array.from({ length: 140 }, (_, index) => `row${String(index).padStart(3, "0")}:汉🙂\n`).join("") + "尾🙂T\n";
  // Seven-byte caps stop before 汉/尾 instead of retaining partial UTF-8 characters.
  const head = "H🙂", tail = "🙂T\n";
  const discarded = Buffer.byteLength(payload) - Buffer.byteLength(head + tail);
  const expected = `${head}…[discarded ${discarded} bytes]…${tail}`;
  for (const name of ["exempt-create", "exempt-set"]) {
    if (name === "exempt-set") {
      await call("terminal_textsend", { name, text: ":", yield_s: 2 });
      assert.deepEqual(await call("terminal_set", { name, output_brake: false }), { name, quiet_notify: false, output_brake: false });
      await call("terminal_textsend", { name, text: "", output_brake: true, yield_s: 0 });
      assert.deepEqual(await call("terminal_set", { name, quiet_notify: false }), { name, quiet_notify: false, output_brake: true }, "later textsend updates the switch without changing quiet_notify");
      await call("terminal_set", { name, output_brake: false });
    }
    const script = await writeOutputScript(tempRoot, name, payload, true);
    const start = notices.length;
    let returned = false, done;
    const pending = call("terminal_textsend", { name, text: script.text, yield_s: 4, ...(name === "exempt-create" ? { output_brake: false } : {}) }).then((result) => { returned = true; return result; });
    try {
      const events = await until(() => notices.slice(start), (items) => items.some((event) => event.kind === "warning" && event.result.name === name), "exemption warning reaches the native notice channel while foregrounded", 2000);
      assert.equal(returned, false, "the warning is not deferred until the foreground tool yields");
      const warning = events.find((event) => event.kind === "warning" && event.result.name === name);
      assert.equal(warning.result.status, "running");
      assert.equal(warning.result.truncated, true);
      assert.match(warning.result.note ?? "", /commandOutputLimitBytes/u);
      assert.match(warning.result.note ?? "", /head.*tail|头.*尾/iu);
    } finally {
      await writeFile(script.release, "release");
      done = await pending;
    }
    assert.equal(done.status, "done");
    assert.equal(done.exit_code, 0, "exemption permits natural completion instead of C-c");
    assert.equal(done.truncated, true);
    await readCommandPages(call, done, expected, true);
    const inside = await call("terminal_read", { name, command: done.command_id, offset: 2 });
    assert(inside.output.startsWith("…[discarded "), "an offset inside the retained emoji skips to its next complete code point");
    assert.deepEqual(notices.slice(start).filter((event) => event.result.command_id === done.command_id).map((event) => event.kind), ["warning"], "one foreground warning, no duplicates or foreground done/quiet events");
  }
}
