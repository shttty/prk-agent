import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePrkConfig } from "../../../../src/config/document/parse-prk-config.ts";

test("kernelTools rejects null at every nesting depth with the offending path", () => {
  for (const [kernelTools, path] of [
    [null, "kernelTools"],
    [{ sample: null }, "kernelTools.sample"],
    [{ sample: { nested: { option: null } } }, "kernelTools.sample.nested.option"],
    [{ sample: { items: [1, null] } }, "kernelTools.sample.items[1]"],
    [{ sample: { items: [{ values: [null] }] } }, "kernelTools.sample.items[0].values[0]"],
  ]) {
    assert.throws(() => parsePrkConfig({ kernelTools }), (error) => {
      assert.equal(error.message, `Invalid PRK configuration: ${path} must not be null.`);
      return true;
    });
  }
  const kernelTools = { sample: { nested: { enabled: false }, items: [0, "", [], {}] } };
  assert.deepEqual(parsePrkConfig({ kernelTools }).kernelTools, kernelTools);
});
