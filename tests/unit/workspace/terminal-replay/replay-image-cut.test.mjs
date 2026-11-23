import assert from "node:assert/strict";
import test from "node:test";
import { TerminalReplay } from "../../../../src/workspace/terminal-replay/create-replay.ts";

const replayOf = (capacity, ...chunks) => {
  const replay = new TerminalReplay(capacity);
  for (const chunk of chunks) replay.append(chunk);
  return replay.snapshot();
};

test("a Sixel image whose start was evicted is dropped up to its ST", () => {
  const snapshot = replayOf(64, "old\r\n\x1bPq\"1;1;8;8#0;2;0;0;0", "#0!8~-".repeat(30), "\x1b\\$ after\r\n");
  assert.equal(snapshot, "\x1b\\$ after\r\n");
});

test("an OSC 1337 image cut at the start ends at its BEL; text after it stays", () => {
  const snapshot = replayOf(48, "\x1b]1337;File=inline=1:", "QUJD".repeat(40), "\x07tail");
  assert.equal(snapshot, "tail");
});

test("a Kitty image still streaming with its start evicted replays as an ignored PM, so later payload stays hidden", () => {
  assert.equal(replayOf(32, "\x1b_Ga=T,f=100;", "QUJD".repeat(20)), "\x1b^");
  assert.equal(replayOf(32, "\x1b]1337;File=:", "QUJD".repeat(20)), "\x1b]");
});

test("an image the ring still holds whole, and controls split across appends, replay unchanged", () => {
  const whole = "pre\x1b_Ga=T;QUJD\x1b\\post";
  assert.equal(replayOf(256, whole), whole);
  assert.equal(replayOf(256, "pre\x1b", "_Ga=T;QU", "JD\x1b", "\\post"), whole);
  // A string that ended before the ring's first byte no longer matters: the cut lands in plain text.
  assert.equal(replayOf(16, "\x1b]133;A\x07", "0123456789abcdefXYZ"), "3456789abcdefXYZ");
});
