import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDerivationConfig } from "../../../../src/config/derivation/parse-config.ts";
import { DEFAULT_DERIVATION_ROLES } from "../../../../src/config/derivation/derivation-types.ts";
import { parsePrkConfig } from "../../../../src/config/document/parse-prk-config.ts";
import { nativeRequest } from "../../../../src/http/request/validate-wire-params.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../../../src/config/limits/limits-options.ts";

test("derivation always includes immutable built-in role defaults", () => {
  assert.deepEqual(Object.keys(DEFAULT_DERIVATION_ROLES), ["task", "small"]);
  assert.equal(DEFAULT_DERIVATION_ROLES.small.toolMode, "direct");
  assert.equal(Object.isFrozen(DEFAULT_DERIVATION_ROLES), true);
  for (const role of Object.values(DEFAULT_DERIVATION_ROLES)) assert.equal(Object.isFrozen(role), true);
  for (const document of [undefined, {}, { derivation: {} }, { derivation: { roles: {} } }]) {
    const config = parseDerivationConfig(document);
    assert.deepEqual({ ...config.roles }, DEFAULT_DERIVATION_ROLES);
    assert.equal(Object.isFrozen(config.roles), true);
  }
  assert.deepEqual({ ...parsePrkConfig({}).derivation.roles }, DEFAULT_DERIVATION_ROLES);
  assert.throws(() => { DEFAULT_DERIVATION_ROLES.small.toolMode = "code"; }, TypeError);
});

test("built-in overrides merge per field and custom roles keep only their configured fields", () => {
  const custom = { description: "Inspect results", model: "fixture/reviewer", thinkingLevel: "low", instructions: "Review only", capabilities: { "tool:read": false } };
  const input = { roles: { task: { model: "fixture/task", isolated: true }, small: { model: "fixture/small" }, reviewer: custom } };
  const config = parseDerivationConfig({ derivation: input });
  assert.deepEqual(config.roles.task, { ...DEFAULT_DERIVATION_ROLES.task, ...input.roles.task });
  assert.deepEqual(config.roles.small, { ...DEFAULT_DERIVATION_ROLES.small, model: "fixture/small" });
  assert.deepEqual(config.roles.reviewer, custom);
  assert.notEqual(config.roles.reviewer.capabilities, custom.capabilities);
  assert.equal(Object.isFrozen(config.roles.task), true);
  const override = parseDerivationConfig({ derivation: { roles: { task: { description: "", instructions: "", isolated: false }, small: { toolMode: "code" } } } });
  assert.deepEqual(override.roles.task, { description: "", instructions: "", isolated: false });
  assert.equal(override.roles.small.toolMode, "code");
  assert.equal(DEFAULT_DERIVATION_ROLES.small.toolMode, "direct");
  assert.deepEqual({ ...parseDerivationConfig({ derivation: { roles: {} } }).roles }, DEFAULT_DERIVATION_ROLES);
});

test("removed derivation model and thinking defaults are rejected by config and HTTP parsing", () => {
  for (const [key, value] of [["defaultModel", "fixture/model"], ["defaultThinkingLevel", "off"]]) {
    for (const removedValue of [value, null, undefined]) {
      const derivation = { [key]: removedValue };
      assert.throws(() => parseDerivationConfig({ derivation }));
      assert.throws(() => parsePrkConfig({ derivation }));
      assert.throws(() => nativeRequest(DEFAULT_LIMITS_OPTIONS, { derivation }, "derivationSet"), (error) => {
        assert.equal(error.status, 400);
        assert.equal(error.code, "INVALID_REQUEST");
        return true;
      });
    }
  }
  assert.equal(parsePrkConfig({ session: { defaultThinkingLevel: "high" } }).session.defaultThinkingLevel, "high");
  const request = { derivation: { roles: { task: { model: "fixture/model", thinkingLevel: "off" } } } };
  assert.deepEqual(nativeRequest(DEFAULT_LIMITS_OPTIONS, request, "derivationSet"), request);
});

test("built-in role overrides retain the same validation as custom roles", () => {
  for (const name of ["task", "small", "reviewer"]) {
    for (const value of [null, { defaultModel: "fixture/model" }, { model: "unqualified" }, { thinkingLevel: "invalid" }, { toolMode: "invalid" }, { isolated: "true" }, { capabilities: { "tool:read": null } }]) {
      assert.throws(() => parseDerivationConfig({ derivation: { roles: { [name]: value } } }));
    }
  }
});
