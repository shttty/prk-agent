import assert from "node:assert/strict";
import { test } from "node:test";
import { decode } from "../../../../src/remote-extensions/codec/decode.mjs";

test("decode preserves scalar types and negative zero", () => {
  for (const [encoded, expected] of [
    [["undefined"], undefined], [["null"], null], [["boolean", false], false],
    [["string", "中文\nsecond line"], "中文\nsecond line"], [["number", 1.25], 1.25],
  ]) assert.equal(decode(encoded), expected);
  assert(Object.is(decode(["number", "-0"]), -0));
  assert(Object.is(decode(["number", 0]), 0));
});

test("decode preserves nested undefined and treats prototype names as ordinary keys", () => {
  const value = decode(["object", [
    ["tag", ["string", "error"]],
    ["__proto__", ["object", [["marker", ["boolean", true]]]]],
    ["nested", ["array", [["undefined"], ["null"]]]],
    ["cleared", ["undefined"]],
  ]]);
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
  assert.equal(Object.hasOwn(value, "__proto__"), true);
  assert.deepEqual(value.__proto__, { marker: true });
  assert.equal(value.marker, undefined);
  assert.equal(value.tag, "error");
  assert.deepEqual(value.nested, [undefined, null]);
  assert.equal(Object.hasOwn(value, "cleared"), true);
  assert.equal(value.cleared, undefined);
});

test("decode restores Errors with non-enumerable identity fields and enumerable details", () => {
  const error = decode(["error", ["object", [
    ["name", ["string", "TypeError"]], ["message", ["string", "invalid"]],
    ["stack", ["string", "original target stack"]], ["cause", ["null"]],
    ["code", ["string", "INVALID_INPUT"]],
  ]]]);
  assert(error instanceof Error);
  assert.equal(error.name, "TypeError");
  assert.equal(error.message, "invalid");
  assert.equal(error.stack, "original target stack");
  assert.equal(error.cause, null);
  assert.equal(Object.hasOwn(error, "cause"), true);
  assert.deepEqual(Object.keys(error), ["code"]);
  assert.equal(error.code, "INVALID_INPUT");
});

test("decode accepts shared encoded values without preserving reference identity", () => {
  const shared = ["object", [["value", ["number", 3]]]];
  const value = decode(["array", [shared, shared]]);
  assert.deepEqual(value, [{ value: 3 }, { value: 3 }]);
  assert.notEqual(value[0], value[1]);
});

test("decode rejects malformed tags, arities and scalar bodies", () => {
  for (const value of [
    null, {}, [], ["unknown"], ["null", null], ["undefined", 0], ["string"],
    ["string", 1], ["boolean", "true"], ["number", "1"], ["number", NaN],
    ["number", Infinity], ["number", 1, 2], ["array", {}], ["object", {}],
  ]) assert.throws(() => decode(value), TypeError);
});

test("decode rejects malformed object entries, duplicate keys and Error fields", () => {
  for (const value of [
    ["object", [["key"]]], ["object", [[1, ["null"]]]],
    ["object", [["key", ["null"]], ["key", ["undefined"]]]],
    ["error", ["null"]], ["error", ["array", []]],
    ["error", ["object", [["message", ["string", "missing name"]]]]],
    ["error", ["object", [["name", ["string", "Error"]], ["message", ["number", 1]]]]],
    ["error", ["object", [["name", ["string", "Error"]], ["message", ["string", "bad stack"]], ["stack", ["null"]]]]],
  ]) assert.throws(() => decode(value), TypeError);
});

test("decode rejects cyclic encoded arrays and objects", () => {
  const array = ["array", []];
  array[1].push(array);
  const object = ["object", []];
  object[1].push(["self", object]);
  for (const value of [array, object]) assert.throws(() => decode(value), TypeError);
});
