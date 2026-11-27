import assert from "node:assert/strict";
import { test } from "node:test";
import { messageMark } from "../../../web/workspace/prompt-view/message-mark.ts";
import { readableJson } from "../../../web/workspace/prompt-view/readable-json.ts";

test("readable JSON keeps the shape of pretty JSON and writes multi-line strings as they are", () => {
  const value = { name: "read", description: "First line.\nSecond line.", parameters: { type: "object", required: ["path"], properties: {} }, list: [], none: null };
  assert.equal(readableJson(value), [
    "{",
    '  "name": "read",',
    '  "description": """',
    "    First line.",
    "    Second line.",
    '  """,',
    '  "parameters": {',
    '    "type": "object",',
    '    "required": [',
    '      "path"',
    "    ],",
    '    "properties": {}',
    "  },",
    '  "list": [],',
    '  "none": null',
    "}",
  ].join("\n"));
  assert.deepEqual(JSON.parse(readableJson({ a: [1, "x", { b: true }] })), { a: [1, "x", { b: true }] });
});

test("a message is new past the previous request's end, and the break is marked where the shared prefix ends", () => {
  const stable = { before: 4, after: 7, commonPrefix: 4, prefixStable: true, firstChange: null };
  assert.deepEqual([2, 3, 4, 6].map((index) => messageMark(stable, index)), [null, null, "新增", "新增"]);
  const broken = { before: 4, after: 7, commonPrefix: 2, prefixStable: false, firstChange: null };
  assert.deepEqual([0, 1, 2, 3, 4, 6].map((index) => messageMark(broken, index)), [null, null, "前缀断开", null, "新增", "新增"]);
  assert.equal(messageMark(null, 3), null);
  assert.equal(messageMark(undefined, 3), null);
});
