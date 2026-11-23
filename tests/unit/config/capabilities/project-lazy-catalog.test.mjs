import assert from "node:assert/strict";
import { test } from "node:test";
import { projectCapabilities } from "../../../../src/sessions/resource-catalog/format-capabilities.ts";

const pluginGroup = "group:tools:package:fixture";
const toolId = "lazy:tool:probe";
const groupId = `lazy:${pluginGroup}`;
const tool = (name, group = pluginGroup, exposure = "direct") => ({
  id: `tool:${name}`, kind: "tool", name, description: `${name} description`, group, groupLabel: group, source: "fixture", exposure,
});

test("catalogs expose lazy status only on supported rows and tool groups", () => {
  const entries = [
    tool("probe"), tool("disabled"), tool("model", "group:tools:package:model", "model-only"),
    tool("kernel_code", "group:tools:package:<inline:kernel>", "model-only"), tool("space_status", "group:tools:package:<inline:sessions>"),
    tool("read", "group:tools:local"), tool("tool_search"), tool("tool_call"),
    { ...tool("read", "group:tools:kernel"), id: "kernel:read" },
    { ...tool("skill", "group:skills:global"), id: "skill:/fixture/SKILL.md", kind: "skill" },
  ];
  const capabilities = { "tool:disabled": false, "lazy:tool:disabled": true, "lazy:tool:model": true, "lazy:tool:space_status": true };
  const catalog = projectCapabilities(entries, { capabilities, localTools: true }, {}, undefined, true, [], [capabilities]);
  const rows = Object.fromEntries(catalog.entries.map((entry) => [entry.id, entry]));
  assert.deepEqual(rows["tool:probe"].lazy, { id: toolId, enabled: false, defaultEnabled: false, overridden: false, available: true });
  assert.equal(rows["tool:disabled"].enabled, false);
  assert.equal(rows["tool:disabled"].lazy.enabled, true);
  assert.equal(rows["tool:disabled"].lazy.available, false);
  assert.equal(rows["tool:model"].exposure, "model-only");
  assert.equal(rows["tool:model"].lazy.available, false);
  assert.equal(rows["tool:model"].lazy.enabled, true);
  assert.equal(rows["tool:kernel_code"].lazy.available, false);
  assert.equal(rows["tool:space_status"].lazy.enabled, true);
  for (const id of ["tool:read", "kernel:read", "skill:/fixture/SKILL.md"]) assert.equal(rows[id].lazy, undefined, id);
  assert.equal(rows["tool:tool_search"], undefined);
  assert.equal(rows["tool:tool_call"], undefined);
  const groups = Object.fromEntries(catalog.groups.map((group) => [group.id, group]));
  assert.equal(groups[pluginGroup].lazy.available, true);
  assert.equal(groups["group:tools:package:model"].lazy.available, false);
  assert.deepEqual(groups["group:tools:package:<inline:kernel>"].lazy, { id: "lazy:group:tools:package:<inline:kernel>", enabled: false, defaultEnabled: false, overridden: false, available: false });
  assert.deepEqual(groups["group:tools:package:<inline:sessions>"].lazy, { id: "lazy:group:tools:package:<inline:sessions>", enabled: false, defaultEnabled: false, overridden: false, available: true });
  for (const id of ["group:tools:local", "group:tools:kernel", "group:skills:global"]) assert.equal(groups[id].lazy, undefined, id);
  assert.equal(catalog.requiresReload, false);
});

test("group lazy is unavailable when its callable members are disabled", () => {
  const capabilities = { "tool:probe": false, [groupId]: true };
  const catalog = projectCapabilities([tool("probe"), tool("model", pluginGroup, "model-only")], { capabilities, localTools: false }, {}, undefined, false);
  assert.equal(catalog.groups[0].lazy.available, false);
  assert.equal(catalog.groups[0].lazy.enabled, true);
  assert.equal(catalog.entries[0].lazy.enabled, true);
  assert.equal(catalog.entries[0].lazy.available, false);
});

test("global, instance and merged live catalogs recompute lazy inheritance without changing enable merging", () => {
  const entries = [tool("probe")];
  const global = { [toolId]: false };
  const instance = { [groupId]: true };
  const session = { [toolId]: false };
  const globalCatalog = projectCapabilities(entries, { capabilities: global, localTools: false }, {}, undefined, true, [], [global]);
  assert.deepEqual(globalCatalog.entries[0].lazy, { id: toolId, enabled: false, defaultEnabled: false, overridden: true, available: true });
  const instanceCatalog = projectCapabilities(globalCatalog.entries, { capabilities: global, localTools: false }, instance, undefined, true, [], [instance, global]);
  assert.deepEqual(instanceCatalog.entries[0].lazy, { id: toolId, enabled: true, defaultEnabled: false, overridden: false, available: true });
  const defaults = { capabilities: { ...global, ...instance }, localTools: false };
  const live = projectCapabilities(instanceCatalog.entries, defaults, session, undefined, true, [], [session, instance, global]);
  assert.deepEqual(live.entries[0].lazy, { id: toolId, enabled: false, defaultEnabled: true, overridden: true, available: true });
  assert.equal(live.entries[0].enabled, true);
  assert.equal(live.entries[0].configured, true);
  assert.equal(live.entries[0].overridden, false);
  assert.equal(live.groups[0].enabled, true);
  assert.equal(live.requiresReload, false);
  delete session[toolId];
  const reset = projectCapabilities(live.entries, defaults, session, undefined, true, [], [session, instance, global]);
  assert.deepEqual(reset.entries[0].lazy, { id: toolId, enabled: true, defaultEnabled: true, overridden: false, available: true });
  const disabledGroup = projectCapabilities(entries, { capabilities: { ...global, [pluginGroup]: false }, localTools: false }, {}, undefined, true, [], [{ [groupId]: true }, { ...global, [pluginGroup]: false }]);
  assert.equal(disabledGroup.entries[0].enabled, false);
  assert.equal(disabledGroup.entries[0].lazy.available, false);
  assert.equal(disabledGroup.groups[0].lazy.available, false);
});
