import assert from "node:assert/strict";
import { test } from "node:test";
import { getSkills } from "../../../../src/sessions/resource-catalog/loader/get-skills.ts";
import { skillEnabled } from "../../../../src/sessions/runtime/resources/skills/is-skill-enabled.ts";

const skill = (path, source = "target") => ({
  name: "probe", description: "Probe", filePath: `${path}/SKILL.md`, baseDir: path,
  sourceInfo: { path, source, scope: source === "target" ? "project" : "user", origin: "top-level" }, disableModelInvocation: false,
});

test("skill getters reselect current enabled winners without discarding registered candidates", () => {
  const near = skill("/target/near/probe");
  const far = skill("/target/far/probe");
  const global = skill("/gateway/agent/skills/probe", "user");
  const inventory = [near, far, global];
  const diagnostics = [{ type: "warning", message: "Preserved SDK diagnostic" }];
  const switches = {};
  const runtime = {
    dependencies: { agentDir: "/gateway/agent" }, target: { id: "fixture", local: false, capabilities: {} },
    sessionOptions: { capabilities: {} }, capabilityOverrides: switches, sharedPaths: new Set(),
    targetSkills: { skills: [near, far], directories: [{ path: "/target/near" }, { path: "/target/far" }] },
  };
  const loader = { getSkills: () => ({ skills: inventory, diagnostics }) };
  const projection = { loader, skills: () => inventory, enabled: (entry) => skillEnabled(runtime, entry) };
  const current = () => getSkills(projection).skills.map(({ filePath }) => filePath);
  assert.deepEqual(current(), [near.filePath]);
  switches[`skill:${near.filePath}`] = false;
  assert.deepEqual(current(), [far.filePath]);
  switches[`group:skills:dir:fixture:/target/far`] = false;
  assert.deepEqual(current(), [global.filePath]);
  switches["group:skills:home"] = false;
  assert.deepEqual(current(), [], "all copies disabled removes the advertised name");
  switches[`skill:${near.filePath}`] = true;
  switches[`group:skills:dir:fixture:/target/near`] = false;
  assert.deepEqual(current(), [near.filePath], "same-layer item overrides its group");
  assert.equal(getSkills(projection).diagnostics, diagnostics);
  assert.equal(loader.getSkills().skills, inventory, "registration inventory is never rewritten");
});
