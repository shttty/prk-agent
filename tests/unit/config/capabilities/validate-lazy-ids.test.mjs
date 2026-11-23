import assert from "node:assert/strict";
import { test } from "node:test";
import { capabilityId } from "../../../../src/config/capabilities/validate-capability-id.ts";
import { isCapabilitySwitches } from "../../../../src/config/capabilities/is-capability-switches.ts";
import { isCapabilityChanges } from "../../../../src/config/capabilities/is-changes.ts";
import { parsePrkConfig } from "../../../../src/config/document/parse-prk-config.ts";

const valid = [
  "lazy:tool:probe", "lazy:tool:mcp__service__lookup", "lazy:tool:prk_saved_probe",
  "lazy:group:tools:package:@fixture/tools", "lazy:group:tools:package:/project with spaces/extension.ts",
  "lazy:group:tools:mcp:service", "lazy:group:tools:remote:instance:@fixture/tools",
  "lazy:group:tools:library", "lazy:group:tools:package:<inline:kernel>", "lazy:group:tools:package:<inline:tool-library>",
];
const invalid = [
  "lazy:", "lazy:tool:", "lazy:tool: probe", "lazy:tool:two names", "lazy:tool:probe\n",
  "lazy:kernel:read", "lazy:skill:/project/SKILL.md", "lazy:group:skills:global",
  "group:tools:prk", "lazy:group:tools:prk", "lazy:group:tools:kernel", "lazy:group:tools:local",
  "lazy:group:tools:package:", "lazy:group:tools:mcp:", "lazy:group:tools:remote:instance",
  "lazy:group:tools:remote::package", "lazy:group:tools:remote:bad instance:package",
  "lazy:lazy:tool:probe", "lazy:group:tools:unknown:package",
  ...valid.map((id) => id.replace(/^lazy:/u, "delay:")),
];

test("lazy IDs accept tool, built-in and plugin tool-group namespaces", () => {
  for (const id of valid) {
    assert.equal(capabilityId(id), true, id);
    assert.equal(isCapabilitySwitches({ [id]: true }), true, id);
    assert.equal(isCapabilityChanges({ [id]: null }), true, id);
    assert.equal(isCapabilitySwitches({ [id]: null }), false, id);
  }
  for (const id of [...invalid, null, 1, {}, []]) assert.equal(capabilityId(id), false, String(id));
  for (const id of invalid) {
    assert.equal(isCapabilitySwitches({ [id]: false }), false, id);
    assert.equal(isCapabilityChanges({ [id]: null }), false, id);
  }
  for (const id of ["tool:probe", "kernel:read", "skill:/project/SKILL.md", "group:tools:library", "group:tools:package:<inline:kernel>"]) {
    assert.equal(isCapabilitySwitches({ [id]: false }), true, "existing enable namespaces stay intact");
  }
  assert.equal(isCapabilitySwitches({ "group:tools:local": true }), false);
});

test("global and instance capability maps persist lazy IDs without mixing enable values", () => {
  const capabilities = Object.fromEntries(valid.map((id, index) => [id, index % 2 === 0]));
  capabilities["tool:probe"] = false;
  const instance = { id: "fixture", label: "Fixture", local: true, python: "/usr/bin/python3", cwd: "/fixture", capabilities };
  const config = parsePrkConfig({ session: { capabilities } }, { instances: [instance] });
  assert.deepEqual(config.session.capabilities, capabilities);
  assert.deepEqual(config.instances[0].capabilities, capabilities);
  for (const id of invalid) {
    assert.throws(() => parsePrkConfig({ session: { capabilities: { [id]: true } } }), /capabilities/, id);
    assert.throws(() => parsePrkConfig({}, { instances: [{ ...instance, capabilities: { [id]: true } }] }), /capabilities/, id);
  }
});
