import assert from "node:assert/strict";
import { test } from "node:test";
import { toolOrigin } from "../../../../src/sessions/resource-catalog/classify-tool-origin.ts";

const nativeNames = new Set();

test("inline plugin display labels and sources omit SDK markers without changing group IDs", () => {
  for (const name of ["kernel", "sessions", "ask", "skill-tools", "memory", "plugin-config", "terminals"]) {
    const tool = { name: "fixture", sourceInfo: { path: `<inline:${name}>`, origin: "top-level" } };
    assert.deepEqual(toolOrigin(tool, nativeNames), { group: `group:tools:package:<inline:${name}>`, groupLabel: name, source: name });
    assert.equal(tool.sourceInfo.path, `<inline:${name}>`);
  }
});

test("ordinary paths remain intact while specialized groups normalize only their display source", () => {
  const sourceInfo = { path: "/project/plugin.ts", origin: "top-level" };
  assert.deepEqual(toolOrigin({ name: "fixture", sourceInfo }, nativeNames), {
    group: "group:tools:package:/project/plugin.ts", groupLabel: sourceInfo.path, source: sourceInfo.path,
  });
  const inlineSource = { path: "<inline:tool-library>", origin: "top-level" };
  assert.deepEqual(toolOrigin({ name: "prk_saved_fixture", sourceInfo: inlineSource }, nativeNames), {
    group: "group:tools:library", groupLabel: "沉淀工具", source: "tool-library",
  });
  assert.deepEqual(toolOrigin({ name: "fixture", sourceInfo, namespace: { name: "mcp__server", aliases: ["Server"] } }, nativeNames), {
    group: "group:tools:mcp:Server", groupLabel: "Server", source: sourceInfo.path,
  });
  assert.deepEqual(toolOrigin({ name: "read", sourceInfo: inlineSource }, new Set(["read"])), {
    group: "group:tools:local", groupLabel: "本机工具", source: "tool-library",
  });
  assert.deepEqual(toolOrigin({ name: "fixture", sourceInfo: inlineSource, namespace: { name: "mcp__server" } }, nativeNames), {
    group: "group:tools:mcp:server", groupLabel: "server", source: "tool-library",
  });
});
