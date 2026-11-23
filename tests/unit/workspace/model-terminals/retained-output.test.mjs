import assert from "node:assert/strict";
import { test } from "node:test";
import { retainText } from "../../../../src/workspace/model-terminals/output/retain-text.ts";
import { renderRetained } from "../../../../src/workspace/model-terminals/output/render-retained.ts";

test("retention accounts for discarded UTF-8 bytes and never splits code points", () => {
  const state = { head: "", tail: "", bytes: 0, headLimit: 7, tailLimit: 7 };
  retainText(state, "头🙂");
  retainText(state, "中间");
  retainText(state, "🙂尾");
  assert.equal(renderRetained(state, ""), "头🙂…[discarded 6 bytes]…🙂尾");
  assert.equal(state.bytes, 20);
  assert.equal(Buffer.byteLength(state.head), 7);
  assert.equal(Buffer.byteLength(state.tail), 7);
});

test("small budgets skip an entire code point without filling the head with later text", () => {
  const state = { head: "", tail: "", bytes: 0, headLimit: 2, tailLimit: 2 };
  retainText(state, "🙂");
  retainText(state, "xyz");
  assert.equal(renderRetained(state, ""), "…[discarded 5 bytes]…yz");
});

test("mutable screen tails are replaced, not appended to the retained stream", () => {
  const state = { head: "", tail: "", bytes: 0, headLimit: 4, tailLimit: 4 };
  retainText(state, "HEAD012345");
  assert.equal(renderRetained(state, "old"), "HEAD…[discarded 5 bytes]…5old");
  assert.equal(renderRetained(state, "TAIL"), "HEAD…[discarded 6 bytes]…TAIL");
  assert.equal(state.bytes, 10);
  assert.equal(state.tail, "2345");
});

test("overlapping endpoints preserve all text once and explicitly report zero discard", () => {
  const state = { head: "", tail: "", bytes: 0, headLimit: 8, tailLimit: 8 };
  retainText(state, "你好");
  assert.equal(renderRetained(state, "尾"), "你好…[discarded 0 bytes]…尾");
});
