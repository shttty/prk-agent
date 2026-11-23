import assert from "node:assert/strict";
import { test } from "node:test";
import { delegationPolicy } from "../../../../src/plugins/sessions/prompt/render-policy.ts";

test("delegation policies identify their level and differ pairwise", () => {
  const levels = ["gated", "restrained", "eager"];
  const policies = levels.map((level) => {
    const policy = delegationPolicy(level);
    assert.ok(policy.includes(level));
    return policy;
  });
  assert.notEqual(policies[0], policies[1]);
  assert.notEqual(policies[0], policies[2]);
  assert.notEqual(policies[1], policies[2]);
});
