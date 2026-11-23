import assert from "node:assert/strict";
import test from "node:test";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";

test("POSIX single-quoted path keeps apostrophes and shell substitutions literal", () => {
  assert.equal(quoteShell("/tmp/a'b$(touch x)"), "'/tmp/a'\\''b$(touch x)'");
  assert.equal(quoteShell(""), "''");
});
