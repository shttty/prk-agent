import assert from "node:assert/strict";
import test from "node:test";
import { readDisclosure } from "../../../web/chat/transcript/presentation/read-disclosure.js";

const key = "session:choice";

test("explicit disclosure overrides automatic defaults in either direction", () => {
  assert.equal(readDisclosure([], key, { defaultOpen: false }), false);
  assert.equal(readDisclosure([], key, { defaultOpen: true }), true);
  assert.equal(readDisclosure([key], key, { defaultOpen: false }), true);
  assert.equal(readDisclosure([`!${key}`], key, { defaultOpen: true }), false);
  assert.equal(readDisclosure(["previous:choice"], key, { fallbackId: "choice" }), true);
});
