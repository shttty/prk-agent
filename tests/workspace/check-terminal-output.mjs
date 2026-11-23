import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TERMINAL_OPTIONS } from "../../src/config/terminal/terminal-options.ts";
import { compactTerminalOutput } from "../../src/workspace/terminal-output/compact-terminal-output.ts";

const options = { ...DEFAULT_TERMINAL_OPTIONS, longLineThresholdChars: 1000, longLineHeadChars: 8, longLineTailChars: 8, longLineContextChars: 4 };
const line = (`HEADabcd${"x".repeat(70_000)}LEFTfooRIGHT${"x".repeat(70_000)}BEFRbarAFTR${"x".repeat(70_000)}LASTfooNEXT`).padEnd(300 * 1024 - 8, "x") + "wxyzTAIL";
const windows = (output) => output.replace(/ …\[\+\d+ chars(?:, terminal_read\(command="[^"]+", offset=\d+\))?\]… /gu, " … ");

test("300 KB search line keeps head, three distinct matches and tail", () => {
  const result = compactTerminalOutput(line, "rg -n 'foo|bar' x", options);
  assert.equal(windows(result.output), "HEADabcd … LEFTfooRIGH … BEFRbarAFTR … LASTfooNEXT … wxyzTAIL");
  assert.equal(result.truncated, true);
});

test("non-search commands, missing matches and unresolvable patterns keep only endpoints", () => {
  for (const command of ["cat x", "rg absent x", "rg -f patterns x", 'rg "$PATTERN" x', "rg $(echo foo) x", "rg 'unterminated", "cat x; rg foo x", "rg --unknown foo x"]) {
    const result = compactTerminalOutput(line, command, options);
    assert.equal(windows(result.output), "HEADabcd … wxyzTAIL", command);
    assert.equal(result.truncated, true);
  }
});

test("search arguments preserve regex alternatives, quotes, escapes and option values", () => {
  const content = `HEADabcd${"x".repeat(1500)}LEFTfoo.barAFTR${"x".repeat(1500)}wxyzTAIL`;
  for (const command of [String.raw`rg -n 'foo\.bar|absent' x`, String.raw`grep -E "foo\.bar|absent" x`, String.raw`rg -g '*.json' -e 'foo\.bar' x`, String.raw`grep --include='*.json' --regexp='foo\.bar' x`, String.raw`rg -ne'foo\.bar' x`, String.raw`rg -F foo.bar x`]) {
    assert.equal(windows(compactTerminalOutput(content, command, options).output), "HEADabcd … LEFTfoo.barAFTR … wxyzTAIL", command);
  }
  for (const [pattern, command] of [["foo'bar", String.raw`grep -F 'foo'\''bar' x`], ['foo"bar', String.raw`rg -F "foo\"bar" x`], ["foo bar", String.raw`rg -F foo\ bar x`]]) {
    const value = `HEADabcd${"x".repeat(1500)}LEFT${pattern}AFTR${"x".repeat(1500)}wxyzTAIL`;
    assert.equal(windows(compactTerminalOutput(value, command, options).output), `HEADabcd … LEFT${pattern}AFTR … wxyzTAIL`);
  }
});

test("short lines remain unchanged and only identical original rows fold", () => {
  assert.deepEqual(compactTerminalOutput("short foo\nbar", "rg 'foo|bar' x", options), { output: "short foo\nbar", truncated: false });
  const first = `HEADabcd${"x".repeat(1500)}wxyzTAIL`;
  const second = `HEADabcd${"y".repeat(1500)}wxyzTAIL`;
  assert.equal(windows(compactTerminalOutput(`${first}\n${second}\n${second}`, "cat x", options).output), "HEADabcd … wxyzTAIL\nHEADabcd … wxyzTAIL ×2");
});

test("configured threshold and window sizes control elision without splitting Unicode", async () => {
  const { parseTerminalOptions } = await import("../../src/config/terminal/parse-terminal-options.ts");
  const tuned = parseTerminalOptions({ longLineThresholdChars: 20, longLineHeadChars: 4, longLineTailChars: 4, longLineContextChars: 2 });
  const value = "HEADxxxxxxxxxABfooCDxxxxxxxxxTAIL";
  assert.equal(windows(compactTerminalOutput(value, "grep -E foo x", tuned).output), "HEAD … ABfooCD … TAIL");
  assert.equal(compactTerminalOutput(value, "grep foo x", { ...tuned, longLineThresholdChars: value.length }).output, value);
  assert.equal(windows(compactTerminalOutput("😀".repeat(30), "cat x", { ...tuned, longLineHeadChars: 3, longLineTailChars: 3 }).output), "😀😀 … 😀😀");
  for (const key of ["longLineThresholdChars", "longLineHeadChars", "longLineTailChars", "longLineContextChars"]) {
    for (const invalid of [-1, 0, 1.5, "80"]) assert.throws(() => parseTerminalOptions({ [key]: invalid }), new RegExp(key));
  }
});

test("overlapping hit windows merge without duplicating content", () => {
  const value = `HEADabcd${"x".repeat(1500)}LEFTfoo-barAFTR${"x".repeat(1500)}wxyzTAIL`;
  assert.equal(windows(compactTerminalOutput(value, "grep -E 'foo|bar' x", options).output), "HEADabcd … LEFTfoo-barAFTR … wxyzTAIL");
});

test("omission hints page the exact original gap, including UTF-8 and folded rows", () => {
  for (const value of [line, `中文前缀\n${line.replaceAll("x", "中")}`, `repeat\nrepeat\nrepeat\n${line}`, ` \r\n \r\n\n${line}`, `${line}\n${line}`]) {
    const result = compactTerminalOutput(value, "rg -n 'foo|bar' x", options, "cmd-test");
    const hints = [...result.output.matchAll(/…\[\+(\d+) chars, terminal_read\(command="cmd-test", offset=(\d+)\)\]…/gu)];
    assert.equal(hints.length, 4);
    const retained = ["HEADabcd", "LEFTfooRIGH", "BEFRbarAFTR", "LASTfooNEXT"];
    for (const [index, hint] of hints.entries()) {
      const start = value.indexOf(retained[index]) + retained[index].length;
      const offset = Number(hint[2]);
      assert.equal(offset, Buffer.byteLength(value.slice(0, start)));
      assert.equal(Buffer.from(value).subarray(offset).toString().slice(0, 20), value.slice(start, start + 20));
      const next = index < 3 ? value.indexOf(retained[index + 1]) : value.indexOf("TAIL") - 4;
      assert.equal(Number(hint[1]), next - start);
    }
  }
});

test("whole-output hints retain exact folded-row offsets and fit the byte cap", () => {
  const value = `same\nsame\nsame\n${Array.from({ length: 200 }, (_, i) => `row-${i}:中文内容`).join("\n")}\n`;
  for (const outputBytes of [4, 40, 200, 500]) {
    const result = compactTerminalOutput(value, "cat x", { ...options, outputBytes }, "cmd-test");
    assert(Buffer.byteLength(result.output) <= outputBytes);
    assert.equal(result.truncated, true);
    if (outputBytes < 200) continue;
    const hint = / …\[\+(\d+) chars, terminal_read\(command="cmd-test", offset=(\d+)\)\]… /u.exec(result.output);
    assert(hint);
    const prefix = result.output.slice(0, hint.index).replace("same ×3", "same\nsame\nsame");
    const suffix = result.output.slice(hint.index + hint[0].length);
    assert.equal(Number(hint[2]), Buffer.byteLength(prefix));
    const page = Buffer.from(value).subarray(Number(hint[2])).toString();
    assert.equal(page, value.slice(prefix.length));
    assert.equal(Number(hint[1]), value.length - prefix.length - suffix.length);
  }
});

test("whole-output limiting never splits an existing long-line hint", () => {
  const result = compactTerminalOutput(line, "rg 'foo|bar' x", { ...options, outputBytes: 200 }, "cmd-test");
  const hint = / …\[\+(\d+) chars, terminal_read\(command="cmd-test", offset=(\d+)\)\]… /u.exec(result.output);
  assert(hint);
  assert.equal(Number(hint[2]), 8);
  assert.equal(Number(hint[1]), line.length - 16);
  assert.equal(result.output.slice(0, hint.index), line.slice(0, 8));
  assert.equal(result.output.slice(hint.index + hint[0].length), line.slice(-8));
  assert(Buffer.byteLength(result.output) <= 200);
});

test("ANSI-transformed and running output never advertise guessed offsets", () => {
  for (const [value, id] of [[`\x1b[31m${line}\x1b[0m`, "cmd-test"], [line, undefined]]) {
    const result = compactTerminalOutput(value, "cat x", options, id);
    assert.match(result.output, /…\[\+\d+ chars\]…/u);
    assert(!result.output.includes("offset="));
  }
});

test("raw carriage-return progress keeps the last state and exact retained offsets", () => {
  const result = compactTerminalOutput("old\rmiddle\rfinal\r\nrepeat\nrepeat\n\n\nend", "", options);
  assert.deepEqual(result, { output: "final\nrepeat ×2\n\nend", truncated: false });
  const value = `old\r${line}\r\n`;
  const paged = compactTerminalOutput(value, "cat x", options, "cmd-test");
  const hint = /terminal_read\(command="cmd-test", offset=(\d+)\)/u.exec(paged.output);
  assert.equal(Number(hint[1]), Buffer.byteLength("old\rHEADabcd"));
});

test("bounded capture gaps remain atomic and retain their original omitted count", () => {
  const head = "HEAD\n" + "a\n".repeat(200);
  const tail = "b\n".repeat(200) + "TRACEBACK_TAIL";
  for (const outputBytes of [200, 50_000]) {
    const result = compactTerminalOutput(head + tail, "", { ...options, outputBytes }, undefined, { at: head.length, chars: 123456 });
    assert(result.output.startsWith("HEAD\n"));
    assert(result.output.endsWith("TRACEBACK_TAIL"));
    assert.match(result.output, /…\[\+123456 chars\]…/u);
    assert.doesNotMatch(result.output, /offset=|terminal_read/);
    assert.equal(result.truncated, true);
    assert(Buffer.byteLength(result.output) <= outputBytes);
  }
});
