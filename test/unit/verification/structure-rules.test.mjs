import assert from "node:assert/strict";
import test from "node:test";
import { allowlistScope } from "../../../scripts/verification/structure/allowlist-scope.mjs";
import { countExportedFunctions } from "../../../scripts/verification/structure/count-exported-functions.mjs";
import { findFileViolations } from "../../../scripts/verification/structure/find-file-violations.mjs";
import { findForbiddenNames } from "../../../scripts/verification/structure/find-forbidden-names.mjs";
import { readCodeLines } from "../../../scripts/verification/structure/read-code-lines.mjs";

test("effective lines skip blanks and comments but keep strings that look like comments", () => {
  const text = ["// a", "", "const url = \"http://x\"; // tail", "/* one", "two */ const b = 1;", "/**", " * doc", " */", "const c = `", "// kept", "`;"].join("\n");
  assert.deepEqual(readCodeLines(text), ['const url = "http://x"; ', " const b = 1;", "const c = `", "// kept", "`;"]);
});

test("exported functions count declarations and arrow constants, not types or plain values", () => {
  const lines = ["export function a() {}", "export async function b() {}", "export const c = (x) => x;", "export const d = 1;", "export type E = () => void;", "function f() {}"];
  assert.equal(countExportedFunctions(lines), 3);
});

test("constants, schema and types files are exempt from the one-function rule", () => {
  const text = "export function a() {}\nexport function b() {}\n";
  assert.deepEqual(findFileViolations("web/x/thing.ts", text), ["exports"]);
  assert.deepEqual(findFileViolations("web/x/thing-types.ts", text), []);
});

test("a generic word breaks the rule as a whole name or trailing role word, not inside a domain compound", () => {
  assert.deepEqual(findForbiddenNames("src/a/utils/read.ts"), ["utils"]);
  assert.deepEqual(findForbiddenNames("src/a/session-manager.test.ts"), ["session-manager"]);
  assert.deepEqual(findForbiddenNames("web/a/ColorHelpers.jsx"), ["ColorHelpers"]);
  assert.deepEqual(findForbiddenNames("src/a/base-name.ts"), []);
  assert.deepEqual(findForbiddenNames("src/a/core-js-compat/read.ts"), []);
});

test("each web top directory owns one allowlist, other roots own one each", () => {
  assert.equal(allowlistScope("web/chat/a/b.js"), "web-chat");
  assert.equal(allowlistScope("web/main.jsx"), "web-root");
  assert.equal(allowlistScope("src/a/b.ts"), "src");
});
