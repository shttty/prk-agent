import assert from "node:assert/strict";
import test from "node:test";
import { parseInstanceConfig } from "../../../src/config/execution-target/parse-instance-config.ts";
import { sanitizeTargets } from "../../../src/gateway/instances/format-public-instances.ts";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";
import { normalizeTarget } from "../../../web/workbench/payloads/normalize-target.js";

const instance = { id: "office", label: "办公机", cwd: "/work", local: true };

test("instance id routes independently of its display label", () => {
  const targets = parseInstanceConfig([instance]);
  assert.equal(targets[0].id, "office");
  assert.equal(targets[0].kernel.target, "office");
  const publicTarget = { id: "office", label: "办公机", local: true, tags: [] };
  assert.deepEqual(sanitizeTargets(targets), [publicTarget]);
  assert.deepEqual(normalizeTarget(publicTarget), publicTarget);
  assert.equal(normalizeTarget({ name: "office", label: "办公机" }), null);
});

test("instance config rejects name even when id is also present; mutation wire accepts only id", () => {
  const { id, ...fields } = instance;
  const old = { name: id, ...fields };
  for (const invalid of [old, { ...old, id }]) {
    assert.throws(() => parseInstanceConfig([invalid]), /replace the removed name field with id/);
  }
  for (const method of ["addTarget", "editTarget"]) {
    const request = (target) => ({ v: 1, id: 1, method, params: { target } });
    assert.doesNotThrow(() => validateRequest(request(instance)));
    assert.throws(() => validateRequest(request(old)), /Invalid v1 request/);
    assert.throws(() => validateRequest(request({ ...old, id })), /Invalid v1 request/);
  }
});
