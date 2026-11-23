import assert from "node:assert/strict";
import { test } from "node:test";
import { projectCapabilities } from "../../../../src/sessions/resource-catalog/format-capabilities.ts";
import { capabilityId } from "../../../../src/config/capabilities/validate-capability-id.ts";

const tool = (name, group, options = {}) => ({
  id: `tool:${name}`, kind: "tool", name, group, groupLabel: group,
  description: `Use ${name}.`, source: "fixture", exposure: "direct", ...options,
});
const project = (entries, layers = [{}, {}, {}]) => projectCapabilities(
  entries, { capabilities: layers.at(-1), localTools: true }, layers[0], undefined, true, [], layers,
);

for (const [group, lazyDefault] of [["group:tools:library", true], ["group:tools:package:<inline:sessions>", false]]) {
  test(`${group} exposes a lazy group default shared by every supported member`, () => {
    const entries = ["probe", "sibling"].map((name) => tool(name, group));
    const catalog = project(entries);
    assert.equal(capabilityId(`lazy:${group}`), true);
    assert.deepEqual(catalog.groups[0].lazy, {
      id: `lazy:${group}`, enabled: lazyDefault, defaultEnabled: lazyDefault, overridden: false, available: true,
    });
    for (const entry of catalog.entries) assert.deepEqual(entry.lazy, {
      id: `lazy:${entry.id}`, enabled: lazyDefault, defaultEnabled: lazyDefault, overridden: false, available: true,
    }, `${entry.name} inherits the group default without a name exception`);
    assert.equal(catalog.requiresReload, false);
  });

  test(`${group} resolves item before group in each layer, then session before instance before global`, () => {
    const entries = [tool("probe", group), tool("sibling", group)];
    const id = "lazy:tool:probe";
    const groupId = `lazy:${group}`;
    for (const enabled of [true, false]) {
      for (const layer of [0, 1, 2]) {
        const layers = [{}, {}, {}];
        layers[layer] = { [groupId]: enabled, [id]: !enabled };
        const catalog = project(entries, layers);
        assert.equal(catalog.groups[0].lazy.enabled, enabled);
        assert.equal(catalog.groups[0].lazy.overridden, layer === 0);
        assert.equal(catalog.entries[0].lazy.enabled, !enabled, "Same-layer member beats its group");
        assert.equal(catalog.entries[0].lazy.overridden, layer === 0);
        assert.equal(catalog.entries[1].lazy.enabled, enabled, "Group changes every unoverridden member");
        assert.equal(catalog.entries[1].lazy.overridden, false, "Inherited group is not a member override");
      }
      for (const lower of [1, 2]) for (let higher = 0; higher < lower; higher++) {
        const layers = [{}, {}, {}];
        layers[lower] = { [id]: !enabled };
        layers[higher] = { [groupId]: enabled };
        assert.equal(project(entries, layers).entries[0].lazy.enabled, enabled, "Higher-layer group beats lower-layer member");
      }
    }
    const session = { [groupId]: false, [id]: true };
    const instance = { [groupId]: false };
    const layers = [session, instance, { [groupId]: true }];
    assert.deepEqual(project(entries, layers).entries[0].lazy, {
      id, enabled: true, defaultEnabled: false, overridden: true, available: true,
    });
    delete session[id];
    assert.equal(project(entries, layers).entries[0].lazy.enabled, false);
    delete session[groupId];
    assert.deepEqual(project(entries, layers).groups[0].lazy, {
      id: groupId, enabled: false, defaultEnabled: false, overridden: false, available: true,
    });
    delete instance[groupId];
    assert.equal(project(entries, layers).groups[0].lazy.enabled, true, "Reset rejoins lower group inheritance");
  });

  test(`${group} lazy availability follows its actual enabled callable members`, () => {
    const entries = [tool("probe", group), tool("model_only", group, { exposure: "model-only" })];
    const session = { [group]: false, "lazy:tool:model_only": true };
    const layers = [session, {}, {}];
    let catalog = project(entries, layers);
    assert.equal(catalog.groups[0].lazy.available, false, "A disabled group with no enabled members is unavailable");
    assert.equal(catalog.entries[0].lazy.available, false);
    session["tool:model_only"] = true;
    catalog = project(entries, layers);
    assert.equal(catalog.entries[1].enabled, true);
    assert.equal(catalog.entries[1].lazy.enabled, true, "Stored model-only setting is retained");
    assert.equal(catalog.entries[1].lazy.available, false, "Model-only declarations are not lazy-capable");
    assert.equal(catalog.groups[0].lazy.available, false, "A model-only member cannot make the group lazy-capable");
    session["tool:probe"] = true;
    catalog = project(entries, layers);
    assert.equal(catalog.groups[0].enabled, false);
    assert.equal(catalog.entries[0].enabled, true);
    assert.equal(catalog.groups[0].lazy.available, true, "An explicitly enabled callable member makes the group available even while its group switch is off");
  });
}

test("plugin lazy defaults stay resident while native and kernel capabilities stay ineligible", () => {
  const plugin = "group:tools:package:fixture";
  const catalog = project([
    tool("plugin_probe", plugin), tool("read", "group:tools:local"),
    tool("kernel_probe", "group:tools:kernel", { id: "kernel:probe" }),
  ]);
  assert.deepEqual(catalog.groups.find((entry) => entry.id === plugin).lazy, {
    id: `lazy:${plugin}`, enabled: false, defaultEnabled: false, overridden: false, available: true,
  });
  assert.equal(catalog.entries[0].lazy.enabled, false);
  for (const group of ["group:tools:local", "group:tools:kernel"]) {
    assert.equal(capabilityId(`lazy:${group}`), false);
    assert.equal(catalog.groups.find((entry) => entry.id === group).lazy, undefined);
    assert.equal(catalog.entries.find((entry) => entry.group === group).lazy, undefined);
  }
});
