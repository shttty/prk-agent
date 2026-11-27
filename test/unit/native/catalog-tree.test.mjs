import assert from "node:assert/strict";
import { test } from "node:test";
import { visit } from "../../../src/sessions/native-interaction/catalog/visit.ts";

const node = (id, children = []) => ({ entry: { id, type: "message" }, children });

test("tree candidates come in pre-order", () => {
  const out = [];
  visit(out, [node("a", [node("b", [node("c")]), node("d")]), node("e")]);
  assert.deepEqual(out.map(({ value }) => value), ["a", "b", "c", "d", "e"]);
});

test("a session chain deeper than the call stack is listed whole", () => {
  let chain = node("n0");
  for (let index = 1; index < 50_000; index++) chain = node(`n${index}`, [chain]);
  const out = [];
  visit(out, [chain]);
  assert.equal(out.length, 50_000);
  assert.equal(out[0].value, "n49999");
  assert.equal(out.at(-1).value, "n0");
});
