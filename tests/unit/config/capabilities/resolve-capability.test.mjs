import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCapability } from "../../../../src/config/capabilities/resolve-capability.ts";
import { projectCapabilities } from "../../../../src/sessions/resource-catalog/format-capabilities.ts";
import { toolLazy } from "../../../../src/config/capabilities/resolve-tool-lazy.ts";
import { toolGroupLazy } from "../../../../src/config/capabilities/resolve-tool-group-lazy.ts";

const id = "skill:/project/probe/SKILL.md";
const group = "group:skills:global";
const entry = { id, kind: "skill", name: "probe", description: "Probe", group, groupLabel: "Global", source: "/project/probe/SKILL.md" };

test("capability layers prefer each layer's item before its group", () => {
  assert.equal(resolveCapability(id, group, [{ [id]: true, [group]: false }]), true);
  assert.equal(resolveCapability(id, group, [{ [id]: false, [group]: true }]), false);
  assert.equal(resolveCapability(id, group, [{ [group]: false }, { [id]: true }]), false);
  assert.equal(resolveCapability(id, group, [{ [group]: true }, { [id]: false }]), true);
  assert.equal(resolveCapability(id, group, [{}, {}]), true);
  assert.equal(resolveCapability(id, undefined, [{ [group]: false }]), true);
});

test("skill catalog winners follow live session, instance and global priorities", () => {
  const fallback = { ...entry, id: "skill:/global/probe/SKILL.md", source: "/global/probe/SKILL.md" };
  const global = { [id]: true };
  const instance = { [group]: false };
  const session = {};
  const catalog = () => projectCapabilities([entry, fallback], { capabilities: { ...global, ...instance }, localTools: false }, session, undefined, false, [], [session, instance, global]);
  assert.equal(catalog().entries[0].enabled, false, "instance group beats global item");
  session[id] = true;
  assert.equal(catalog().entries[0].enabled, true, "session item beats inherited group");
  assert.equal(catalog().entries[1].shadowedBy, id);
  session[group] = false;
  assert.equal(catalog().entries[0].enabled, true, "same-layer item wins against disabled group");
  delete session[id];
  assert.equal(catalog().entries[0].enabled, false);
  delete session[group];
  delete instance[group];
  assert.equal(catalog().entries[0].enabled, true, "reset rejoins current inherited values");
});

test("lazy overrides belong to the item's own key at the current layer", () => {
  const group = "group:tools:package:probe";
  const id = "lazy:tool:probe";
  const groupId = `lazy:${group}`;
  const tool = { name: "probe", group, enabled: true };
  const global = { [id]: false };
  const instance = { [groupId]: true };
  const session = { [groupId]: false };
  const state = () => toolLazy(tool, [session, instance, global]);
  assert.deepEqual(state(), { id, enabled: false, defaultEnabled: true, overridden: false, available: true });
  assert.equal(toolGroupLazy(group, true, [session, instance, global]).overridden, true);
  session[id] = true;
  assert.deepEqual(state(), { id, enabled: true, defaultEnabled: true, overridden: true, available: true });
  session[id] = false;
  assert.equal(state().overridden, true, "explicit false is an override too");
  delete session[id];
  delete session[groupId];
  assert.deepEqual(state(), { id, enabled: true, defaultEnabled: true, overridden: false, available: true });
  assert.equal(toolGroupLazy(group, true, [session, instance, global]).overridden, false);
  assert.equal(toolLazy(tool, [instance, global]).overridden, false, "instance group does not mark its tools overridden");
  assert.equal(toolLazy(tool, [global]).overridden, true, "global item marks only its own level overridden");
});

test("enable overrides already distinguish group settings from item settings", () => {
  const overrides = { [group]: false };
  const catalog = () => projectCapabilities([entry], { capabilities: {}, localTools: false }, overrides, undefined, false);
  assert.equal(catalog().entries[0].enabled, false);
  assert.equal(catalog().entries[0].overridden, false);
  assert.equal(catalog().groups[0].overridden, true);
  overrides[id] = true;
  assert.equal(catalog().entries[0].enabled, true);
  assert.equal(catalog().entries[0].overridden, true);
});
