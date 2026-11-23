import assert from "node:assert/strict";
import { test } from "node:test";
import { toolLazy } from "../../../../src/config/capabilities/resolve-tool-lazy.ts";
import { toolGroupLazy } from "../../../../src/config/capabilities/resolve-tool-group-lazy.ts";

const plugin = { name: "probe", group: "group:tools:package:fixture", exposure: "direct", enabled: true };
const id = "lazy:tool:probe";
const group = "lazy:group:tools:package:fixture";

test("only saved-library groups default lazy; every plugin uses the resident default", () => {
  for (const name of ["prk_saved_probe", "prk_saved_other"]) {
    assert.deepEqual(toolLazy({ ...plugin, name, group: "group:tools:library" }, []), {
      id: `lazy:tool:${name}`, enabled: true, defaultEnabled: true, overridden: false, available: true,
    });
  }
  assert.deepEqual(toolLazy(plugin, []), { id, enabled: false, defaultEnabled: false, overridden: false, available: true });
  for (const [name, origin] of [
    ["kernel_code", "package:<inline:kernel>"], ["ask", "package:<inline:ask>"], ["space_status", "package:<inline:sessions>"],
    ["skill_read", "package:<inline:skill-tools>"], ["terminal_textsend", "package:<inline:terminals>"],
    ["todo", "package:fixture"], ["python", "package:fixture"], ["probe", "package:fixture"], ["probe", "mcp:fixture"], ["probe", "remote:instance:fixture"],
  ]) {
    assert.equal(toolLazy({ ...plugin, name, group: `group:tools:${origin}` }, []).enabled, false);
    assert.equal(toolGroupLazy(`group:tools:${origin}`, true, []).enabled, false);
  }
  assert.equal(toolGroupLazy("group:tools:package:<inline:tool-library>", false, []).enabled, false);
});

test("sessions use plugin lazy defaults and ordinary global, instance and session overrides", () => {
  const sessionsGroup = "group:tools:package:<inline:sessions>";
  const global = { "lazy:tool:space_status": true, "lazy:tool:session_list": true, "lazy:tool:session_manage": true };
  for (const name of ["space_status", "session_spawn", "session_send", "session_result", "session_list", "session_manage"]) {
    const tool = { ...plugin, name, group: sessionsGroup };
    const toolId = `lazy:tool:${name}`;
    assert.equal(toolLazy(tool, []).enabled, false, `${name} has no name-based lazy default`);
    assert.equal(toolLazy(tool, [{}, {}, global]).enabled, global[toolId] ?? false);
    assert.equal(toolLazy(tool, [{}, { [`lazy:${sessionsGroup}`]: false }, global]).enabled, false);
    assert.equal(toolLazy(tool, [{ [toolId]: true }, { [`lazy:${sessionsGroup}`]: false }, global]).enabled, true);
  }
});

test("native/meta/kernel groups have no lazy setting; model-only and disabled tools retain unavailable values", () => {
  for (const name of ["read", "bash", "edit", "write", "grep", "find", "ls"]) {
    assert.equal(toolLazy({ ...plugin, name, group: "group:tools:local" }, [{ [`lazy:tool:${name}`]: true }]), undefined);
  }
  for (const name of ["tool_search", "tool_call"]) assert.equal(toolLazy({ ...plugin, name }, []), undefined);
  for (const origin of ["kernel", "local", "unknown"]) {
    assert.equal(toolLazy({ ...plugin, group: `group:tools:${origin}` }, []), undefined);
    assert.equal(toolGroupLazy(`group:tools:${origin}`, true, []), undefined);
  }
  for (const state of [{ enabled: false }, { exposure: "model-only" }]) {
    const lazy = toolLazy({ ...plugin, ...state }, [{ [id]: true }]);
    assert.equal(lazy.enabled, true);
    assert.equal(lazy.available, false);
    assert.equal(lazy.overridden, true);
  }
  assert.equal(toolGroupLazy(plugin.group, false, [{ [group]: true }]).available, false);
});

test("session beats instance beats global before tool-specific beats group within each layer", () => {
  for (const lower of [1, 2]) for (const higher of Array.from({ length: lower }, (_, index) => index)) {
    for (const highId of [id, group]) for (const lowId of [id, group]) {
      for (const enabled of [true, false]) {
        const layers = [{}, {}, {}];
        layers[higher][highId] = enabled;
        layers[lower][lowId] = !enabled;
        assert.equal(toolLazy(plugin, layers).enabled, enabled, `${higher}:${highId} must beat ${lower}:${lowId}`);
      }
    }
  }
  for (const layer of [0, 1, 2]) for (const enabled of [true, false]) {
    const layers = [{}, {}, {}];
    layers[layer] = { [id]: enabled, [group]: !enabled };
    assert.equal(toolLazy(plugin, layers).enabled, enabled);
  }
});

test("resetting each layer restores inheritance and reports current-layer override status", () => {
  const session = { [group]: false };
  const instance = { [id]: true };
  const global = { [group]: false };
  const layers = [session, instance, global];
  assert.deepEqual(toolLazy(plugin, layers), { id, enabled: false, defaultEnabled: true, overridden: false, available: true });
  delete session[group];
  assert.deepEqual(toolLazy(plugin, layers), { id, enabled: true, defaultEnabled: true, overridden: false, available: true });
  delete instance[id];
  assert.equal(toolLazy(plugin, layers).enabled, false);
  global[group] = true;
  assert.equal(toolLazy(plugin, layers).enabled, true);
  delete global[group];
  assert.equal(toolLazy(plugin, layers).enabled, false);
  assert.deepEqual(toolLazy(plugin, [{ [id]: true }]), { id, enabled: true, defaultEnabled: false, overridden: true, available: true });
  assert.deepEqual(toolGroupLazy(plugin.group, true, [{ [group]: false }, { [group]: true }]), {
    id: group, enabled: false, defaultEnabled: true, overridden: true, available: true,
  });
});

test("plugin group settings inherit and reset across all three layers", () => {
  const session = { [group]: false };
  const instance = { [group]: true };
  const global = { [group]: false };
  const layers = [session, instance, global];
  assert.deepEqual(toolGroupLazy(plugin.group, true, layers), { id: group, enabled: false, defaultEnabled: true, overridden: true, available: true });
  delete session[group];
  assert.deepEqual(toolGroupLazy(plugin.group, true, layers), { id: group, enabled: true, defaultEnabled: true, overridden: false, available: true });
  delete instance[group];
  assert.equal(toolGroupLazy(plugin.group, true, layers).enabled, false);
  global[group] = true;
  assert.equal(toolGroupLazy(plugin.group, true, layers).enabled, true);
  delete global[group];
  assert.equal(toolGroupLazy(plugin.group, true, layers).enabled, false);
});
