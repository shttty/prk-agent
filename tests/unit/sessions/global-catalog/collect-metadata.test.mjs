import assert from "node:assert/strict";
import { test } from "node:test";
import { collectMetadata } from "../../../../src/sessions/global-catalog/collect-metadata.ts";
import { toolOrigin } from "../../../../src/sessions/resource-catalog/classify-tool-origin.ts";
import { projectCapabilities } from "../../../../src/sessions/resource-catalog/format-capabilities.ts";

const names = ["session_list", "session_manage", "session_result", "session_send", "session_spawn", "space_status"];
const group = "group:tools:package:<inline:sessions>";

test("global metadata uses registered inline tools and keeps saved-library grouping independent", () => {
  const ctx = {
    input: { toolLibrary: { list: () => [] }, skillLibrary: { list: () => [], paths: () => [] } },
    nativeNames: new Set(), failures: [],
  };
  const registered = names.map((name) => ({ name, description: `Use ${name}.`, sourceInfo: {
    path: "<inline:sessions>", source: "inline", scope: "temporary", origin: "top-level",
  } }));
  registered.push({ name: "kernel_code", description: "Execute session code", exposure: "model-only", sourceInfo: {
    path: "<inline:kernel>", source: "inline", scope: "temporary", origin: "top-level",
  } }, { name: "prk_saved_probe", description: "Execute saved Python code", exposure: "codemode", sourceInfo: {
    path: "<inline:tool-library>", source: "inline", scope: "temporary", origin: "top-level",
  } });
  const session = { getAllTools: () => registered, resourceLoader: {
    getSkills: () => ({ skills: [], diagnostics: [] }), getExtensions: () => ({ extensions: [{ tools: new Map(registered.map((tool) => [tool.name, tool])) }] }),
  } };
  const metadata = collectMetadata(ctx, session);
  const entries = [...metadata.tools.values()].map((tool) => ({
    ...tool, ...toolOrigin(tool, ctx.nativeNames), id: `tool:${tool.name}`, kind: "tool",
  }));
  assert.deepEqual(entries.filter((tool) => tool.group === group).map(({ name }) => name).sort(), names);
  for (const tool of entries.filter((tool) => tool.group === group)) {
    assert.deepEqual(tool.sourceInfo, { path: "<inline:sessions>", source: "inline", scope: "temporary", origin: "top-level" });
    assert.equal(tool.id, `tool:${tool.name}`);
    assert.equal(tool.groupLabel, "sessions");
    assert.equal(tool.source, "sessions");
  }
  assert.equal(entries.find(({ name }) => name === "space_status").group, group);
  assert.equal(entries.find(({ name }) => name === "kernel_code").group, "group:tools:package:<inline:kernel>");
  assert.equal(entries.find(({ name }) => name === "prk_saved_probe").group, "group:tools:library");
  const global = { "lazy:tool:space_status": true, "lazy:tool:session_list": true, "lazy:tool:session_manage": true };
  const catalog = projectCapabilities(entries, { capabilities: global, localTools: false }, {}, undefined, true, [], [global]);
  for (const tool of catalog.entries.filter((tool) => tool.group === group)) {
    assert.equal(tool.lazy.enabled, global[`lazy:tool:${tool.name}`] ?? false);
  }
  assert.equal(catalog.groups.find(({ id }) => id === group).lazy.id, `lazy:${group}`);
  assert.equal(catalog.groups.find(({ id }) => id === group).name, "sessions");
  const disabled = projectCapabilities(entries, { capabilities: { [group]: false }, localTools: false }, {}, undefined, true);
  assert(disabled.entries.filter((tool) => tool.group === group).every((tool) => !tool.enabled));
  assert.equal(disabled.entries.find(({ name }) => name === "space_status").enabled, false);
  assert.equal(disabled.entries.find(({ name }) => name === "kernel_code").enabled, true);
  assert.equal(disabled.entries.find(({ name }) => name === "prk_saved_probe").enabled, true);
  assert.equal(disabled.entries.find(({ name }) => name === "prk_saved_probe").lazy.enabled, true);
});
