import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonMetadata } from "../../../../../src/remote-extensions/registration/metadata/validate-json-metadata.mjs";

test("jsonMetadata preserves JSON values and returns independent metadata", () => {
  const value = { label: "中文", active: true, count: 2, nullable: null, nested: [{ name: "tool" }] };
  const result = jsonMetadata(value, "Tool metadata");
  assert.deepEqual(result, value);
  assert.notEqual(result, value);
  assert.notEqual(result.nested, value.nested);
  assert.notEqual(result.nested[0], value.nested[0]);
});

test("jsonMetadata rejects undefined and Error at every nesting level with its label", () => {
  for (const value of [undefined, new Error("bad"), [undefined], { missing: undefined }, { nested: [new Error("bad")] }]) {
    assert.throws(() => jsonMetadata(value, "probe.parameters"), /probe\.parameters must be JSON-only/);
  }
});

test("jsonMetadata rejects values unsupported by the transport codec", () => {
  const cycle = {};
  cycle.self = cycle;
  for (const value of [NaN, Infinity, 1n, Symbol("metadata"), () => {}, new Date(0), cycle]) {
    assert.throws(() => jsonMetadata(value, "Tool metadata"), TypeError);
  }
});

test("jsonMetadata retains prototype-named keys as ordinary data", () => {
  const result = jsonMetadata({ ["__proto__"]: { marker: true }, constructor: "user value" }, "Tool metadata");
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.hasOwn(result, "__proto__"), true);
  assert.deepEqual(result.__proto__, { marker: true });
  assert.equal(result.marker, undefined);
  assert.equal(result.constructor, "user value");
});
