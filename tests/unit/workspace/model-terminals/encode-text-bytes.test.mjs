import assert from "node:assert/strict";
import test from "node:test";
import { textBytes } from "../../../../src/workspace/model-terminals/input/encode-text-bytes.ts";

test("textBytes wraps text in bracketed paste markers when bracketedPasteMode is enabled", () => {
  assert.equal(textBytes("echo 'x!y'\n\tfalse", true, true), "\x1b[200~echo 'x!y'\n\tfalse\x1b[201~\r");
  assert.equal(textBytes("y\r\nz", true, false), "\x1b[200~y\nz\x1b[201~\r");
  assert.equal(textBytes("", true, true), "\x1b[200~\x1b[201~\r");
});

test("textBytes uses eval-base64 at PRK bash prompt when bracketedPasteMode is off and text has newline or tab", () => {
  const multiline = "cat <<'EOF' > out.txt\na\tb\nEOF\necho \"x!y\"\nfalse";
  assert.equal(
    textBytes(multiline, false, true),
    `eval "$(printf %s ${Buffer.from(multiline, "utf8").toString("base64")} | base64 -d)"\r`,
  );
  const tabbed = "printf 'a\tb\\n'";
  assert.equal(
    textBytes(tabbed, false, true),
    `eval "$(printf %s ${Buffer.from(tabbed, "utf8").toString("base64")} | base64 -d)"\r`,
  );
  const crlf = "echo 1\r\necho 2";
  assert.equal(
    textBytes(crlf, false, true),
    `eval "$(printf %s ${Buffer.from("echo 1\necho 2", "utf8").toString("base64")} | base64 -d)"\r`,
  );
});

test("textBytes sends plain carriage-return lines for single-line prompt commands or running non-bracketed programs", () => {
  assert.equal(textBytes("echo 'x!y'", false, true), "echo 'x!y'\r");
  assert.equal(textBytes("y", false, false), "y\r");
  assert.equal(textBytes("line1\nline2\tcol", false, false), "line1\rline2\tcol\r");
  assert.equal(textBytes("a\r\nb", false, false), "a\rb\r");
});

test("textBytes deterministically rejects C0 control characters and DEL other than tab and newline", () => {
  for (const ch of ["\x00", "\x03", "\x04", "\x07", "\x08", "\x0b", "\x0c", "\r", "\x1b", "\x1f", "\x7f"]) {
    assert.throws(
      () => textBytes(`before${ch}after`, true, true),
      (error) => error?.code === "INVALID_REQUEST" && /terminal_keysend/u.test(error.message),
      `Expected control char 0x${ch.charCodeAt(0).toString(16)} to be rejected`,
    );
  }
});
