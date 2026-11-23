import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePrkConfig } from "../../../../src/config/document/parse-prk-config.ts";

test("derived lifecycle defaults temporary and accepts only temporary or persistent", () => {
  assert.equal(parsePrkConfig({}).session.defaultDerivedLifecycle, "temporary");
  for (const defaultDerivedLifecycle of ["temporary", "persistent"]) {
    assert.equal(parsePrkConfig({ session: { defaultDerivedLifecycle } }).session.defaultDerivedLifecycle, defaultDerivedLifecycle);
  }
  for (const defaultDerivedLifecycle of [null, false, 1, [], {}, "", "user", "TEMPORARY", "forever"]) {
    assert.throws(() => parsePrkConfig({ session: { defaultDerivedLifecycle } }), /session\.defaultDerivedLifecycle.*temporary.*persistent/);
  }
});
