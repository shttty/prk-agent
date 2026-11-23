import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePrkConfig } from "../../../../src/config/document/parse-prk-config.ts";
import { DELEGATION_LEVELS } from "../../../../src/config/session/delegation-levels.ts";

test("session delegation defaults eager and accepts exactly the three policy levels", () => {
  assert.equal(parsePrkConfig({}).session.delegation, "eager");
  for (const delegation of DELEGATION_LEVELS) {
    assert.equal(parsePrkConfig({ session: { delegation } }).session.delegation, delegation);
  }
  for (const delegation of [null, false, 1, [], {}, "", "off", "EAGER"]) {
    assert.throws(() => parsePrkConfig({ session: { delegation } }), /session\.delegation.*gated.*restrained.*eager/);
  }
  assert.throws(() => parsePrkConfig({ session: { delegationLevel: "gated" } }), /unsupported session\.delegationLevel/);
});
