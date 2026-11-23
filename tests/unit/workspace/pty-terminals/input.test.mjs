import assert from "node:assert/strict";
import test from "node:test";
import { validatePtyInput } from "../../../../src/workspace/pty-terminals/validate-input.ts";

test("PTY input counts UTF-8 bytes rather than characters", () => {
  assert.doesNotThrow(() => validatePtyInput("β😀", 6));
  assert.throws(() => validatePtyInput("β😀", 5), (error) => error.code === "TOO_LARGE");
});
test("PTY input accepts exact boundary and control keys", () => {
  assert.doesNotThrow(() => validatePtyInput("\x03", 1));
  assert.doesNotThrow(() => validatePtyInput("", 1));
  assert.doesNotThrow(() => validatePtyInput("ab", 2));
  assert.throws(() => validatePtyInput("abc", 2), (error) => error.code === "TOO_LARGE");
});
