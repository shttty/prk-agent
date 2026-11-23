import assert from "node:assert/strict";

export async function readCommandPages(call, command, expected, retained = false) {
  const bytes = Buffer.from(expected);
  let output = "", pages = 0;
  for (let offset = 0; offset < bytes.length;) {
    const page = await call("terminal_read", { name: command.name, command: command.command_id, offset });
    const part = Buffer.from(page.output);
    assert.equal(page.status, "done");
    assert.equal(page.exit_code, command.exit_code);
    assert.equal(page.total_bytes, bytes.length, "total_bytes addresses only the retained text");
    assert(part.length > 0 && part.length <= 32, "each UTF-8 page makes bounded progress");
    assert(!page.output.includes("\ufffd"), "pages never split a code point");
    assert.deepEqual(part, bytes.subarray(offset, offset + part.length), "page bytes match their exact retained-text offset");
    offset += part.length;
    assert.equal(page.truncated, retained || offset < bytes.length);
    output += page.output;
    pages++;
  }
  assert.equal(output, expected);
  assert(pages > 1, "the fixture exercises more than one output page");
  const end = await call("terminal_read", { name: command.name, command: command.command_id, offset: bytes.length });
  assert.equal(end.output, "", "the original discarded middle cannot be fetched beyond the retained text");
  assert.equal(end.total_bytes, bytes.length);
  assert.equal(end.truncated, retained);
  return output;
}
