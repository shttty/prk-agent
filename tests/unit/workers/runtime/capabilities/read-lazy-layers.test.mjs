import assert from "node:assert/strict";
import { test } from "node:test";
import { lazyLayers } from "../../../../../src/sessions/runtime/capabilities/read-lazy-layers.ts";
import { toolLazy } from "../../../../../src/config/capabilities/resolve-tool-lazy.ts";

const id = "lazy:tool:probe";
const group = "lazy:group:tools:package:fixture";
const tool = { name: "probe", group: "group:tools:package:fixture", enabled: true };

test("direct runtimes keep session, target and global lazy layers separate and live", () => {
  const session = {};
  const instance = { [group]: true };
  const global = { [id]: false };
  const ctx = { dependencies: {}, target: { id: "fixture", capabilities: instance }, sessionOptions: { capabilities: global }, capabilityOverrides: session };
  const layers = lazyLayers(ctx);
  assert.deepEqual(layers, [session, instance, global]);
  assert.equal(layers[1], instance);
  assert.equal(layers[2], global);
  assert.equal(toolLazy(tool, layers).enabled, true, "instance group beats global tool");
  session[id] = false;
  assert.equal(toolLazy(tool, lazyLayers(ctx)).enabled, false);
  delete session[id];
  assert.equal(toolLazy(tool, lazyLayers(ctx)).enabled, true);
});

test("Gateway layer callback reads replacements, while legacy defaults remain one supplied layer", () => {
  let instance = { [group]: true };
  let global = { [id]: false };
  const ctx = {
    dependencies: {
      capabilityDefaults: () => ({ capabilities: { ...global, ...instance }, localTools: false }),
      capabilityLayers: (name) => { assert.equal(name, "fixture"); return [instance, global]; },
    },
    target: { id: "fixture", capabilities: {} }, sessionOptions: { capabilities: {} }, capabilityOverrides: {},
  };
  assert.equal(toolLazy(tool, lazyLayers(ctx)).enabled, true);
  instance = {};
  global = { [id]: true };
  assert.equal(toolLazy(tool, lazyLayers(ctx)).enabled, true);
  global = { [id]: false };
  assert.equal(toolLazy(tool, lazyLayers(ctx)).enabled, false);
  delete ctx.dependencies.capabilityLayers;
  assert.deepEqual(lazyLayers(ctx), [{}, { [id]: false }]);
});
