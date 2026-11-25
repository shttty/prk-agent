import assert from "node:assert/strict";
import test from "node:test";
import { turnGrouping } from "../../../web/chat/transcript/turns/turn-grouping.js";

const text = (value) => ({ type: "text", text: value });
const tool = (id) => ({ type: "tool-call", toolCallId: id });
const thought = { type: "reasoning", text: "Private plan" };
const group = (groupKey, ...indices) => ({ groupKey, indices });

test("segment folding leaves every non-process part in place", () => {
  const parts = [text("Before"), tool("first"), thought, text("After"), { type: "image" }, thought, tool("second"), text("Finally")];
  assert.deepEqual(turnGrouping(parts, true), [
    group(undefined, 0), group("tool:first", 1, 2), group(undefined, 3, 4),
    group("reasoning:5", 5, 6), group(undefined, 7),
  ]);
});

test("unwritten text does not interrupt a segment or add an empty line", () => {
  const parts = [text("Answer before housekeeping"), tool("first"), text(" "), tool("second"), text("")];
  assert.deepEqual(turnGrouping(parts, true), [group(undefined, 0), group("tool:first", 1, 3)]);
});

test("a running thought keeps the same group identity when a tool appends", () => {
  assert.deepEqual(turnGrouping([text("Working"), thought], false), [group(undefined, 0), group("reasoning:1", 1)]);
  assert.deepEqual(turnGrouping([text("Working"), thought, tool("next"), text("")], false), [group(undefined, 0), group("reasoning:1", 1, 2)]);
});

test("whole process folding keeps earlier text inside and preserves the housekeeping exception", () => {
  const parts = [text("Before"), thought, text("Answer"), tool("housekeeping"), text("")];
  assert.deepEqual(turnGrouping(parts, true, "whole"), [group("process", 0, 1, 3), group(undefined, 2, 4)]);
  assert.deepEqual(turnGrouping(parts, false, "whole"), [group("process", 0, 1, 2, 3), group(undefined, 4)]);
  assert.deepEqual(turnGrouping([...parts, text("Final answer")], true, "whole"), [group("process", 0, 1, 2, 3), group(undefined, 4, 5)]);
});
