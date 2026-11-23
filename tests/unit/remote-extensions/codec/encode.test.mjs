import assert from "node:assert/strict";
import { test } from "node:test";
import { encode } from "../../../../src/remote-extensions/codec/encode.mjs";

test("encode preserves scalar types and negative zero", () => {
  for (const [value, expected] of [
    [undefined, ["undefined"]], [null, ["null"]], [true, ["boolean", true]],
    [false, ["boolean", false]], ["中文\nsecond line", ["string", "中文\nsecond line"]],
    [0, ["number", 0]], [-0, ["number", "-0"]], [1.25, ["number", 1.25]],
  ]) assert.deepEqual(encode(value), expected);
});

test("encode tags nested objects without reserving user keys", () => {
  const value = Object.assign(Object.create(null), {
    tag: "undefined", ["__proto__"]: [undefined, null], nested: { cleared: undefined },
  });
  assert.deepEqual(encode(value), ["object", [
    ["tag", ["string", "undefined"]],
    ["__proto__", ["array", [["undefined"], ["null"]]]],
    ["nested", ["object", [["cleared", ["undefined"]]]]],
  ]]);
});

test("encode retains Error identity fields, cause and enumerable details", () => {
  const error = new TypeError("invalid 中文", { cause: { reason: "input" } });
  error.stack = "TypeError: invalid 中文\n  at extension.ts:1";
  error.code = "INVALID_INPUT";
  assert.deepEqual(encode(error), ["error", ["object", [
    ["name", ["string", "TypeError"]],
    ["message", ["string", "invalid 中文"]],
    ["stack", ["string", "TypeError: invalid 中文\n  at extension.ts:1"]],
    ["cause", ["object", [["reason", ["string", "input"]]]]],
    ["code", ["string", "INVALID_INPUT"]],
  ]]]);
});

test("encode accepts repeated references that are not ancestor cycles", () => {
  const shared = { value: 3 };
  assert.deepEqual(encode([shared, shared]), ["array", [
    ["object", [["value", ["number", 3]]]],
    ["object", [["value", ["number", 3]]]],
  ]]);
});

test("encode rejects object, array and Error cause cycles", () => {
  const object = {};
  object.self = object;
  const array = [];
  array.push(array);
  const error = new Error("cycle");
  error.cause = error;
  for (const value of [object, array, error]) assert.throws(() => encode(value), /rejects cycles/);
});

test("encode rejects unsupported primitives, instances and non-finite numbers", () => {
  for (const value of [NaN, Infinity, -Infinity, 1n, Symbol("value"), () => {}, new Date(0), new Map(), new Set()]) {
    assert.throws(() => encode(value), TypeError);
  }
});

test("encode rejects sparse arrays, array properties and symbol keys", () => {
  const extra = [1];
  extra.note = "not an element";
  for (const value of [Array(1), extra, { [Symbol("key")]: 1 }]) {
    assert.throws(() => encode(value), TypeError);
  }
});

test("encode rejects accessors without evaluating them", () => {
  const value = Object.defineProperty({}, "secret", {
    enumerable: true,
    get() { throw new Error("Accessor must not execute"); },
  });
  assert.throws(() => encode(value), /rejects accessor properties/);
});
