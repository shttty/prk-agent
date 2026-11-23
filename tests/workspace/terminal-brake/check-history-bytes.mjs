import assert from "node:assert/strict";
import { readCommandPages } from "./read-command-pages.mjs";

export async function checkHistoryBytes({ call }) {
  const send = (text) => call("terminal_textsend", { name: "history", text, yield_s: 3 });
  const firstOutput = "A汉🙂\n".repeat(10);
  const secondOutput = "B汉🙂\n".repeat(10);
  assert.equal(Buffer.byteLength(firstOutput), 90);
  assert.equal(Buffer.byteLength(secondOutput), 90);
  const first = await send("printf 'A汉🙂\\n%.0s' {1..10}");
  const second = await send("printf 'B汉🙂\\n%.0s' {1..10}");
  await send(":");
  await readCommandPages(call, first, firstOutput);
  await readCommandPages(call, second, secondOutput);
  const third = await send("printf 'C汉🙂\\n'");
  await send(":");
  await assert.rejects(() => call("terminal_read", { name: "history", command: first.command_id }), (error) => error.code === "NOT_FOUND", "one extra UTF-8 output exceeds the 180-byte budget and evicts the oldest command");
  await readCommandPages(call, second, secondOutput);
  const retained = await call("terminal_read", { name: "history", command: third.command_id });
  assert.equal(retained.output, "C汉🙂\n", "the newer command survives oldest-first eviction");
  assert.equal(retained.total_bytes, 9);
  assert.equal(retained.truncated, false);
}
