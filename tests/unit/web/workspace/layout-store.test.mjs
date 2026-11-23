import assert from "node:assert/strict";
import { test } from "node:test";

const saved = new Map();
globalThis.localStorage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)), removeItem: (key) => saved.delete(key) };
const { LAYOUT, layout, layoutKey } = await import("../../../../web/shell/layout/layout-store.js");
const { toggleWorkspace } = await import("../../../../web/shell/page/chrome/toggle-workspace.js");
const { resetLayout } = await import("../../../../web/shell/page/chrome/reset-layout.js");

test("the tree is a popover until the user pins it", () => {
  assert.deepEqual([LAYOUT.treeOpen, LAYOUT.treePinned], [false, false]);
});

test("the stage grid replaces the old column sizes and stage swap: no saved values for them", () => {
  for (const name of ["terminalOpen", "terminalHeight", "terminalDrawerWidth", "workspacePrimary", "chatWidth", "editorWidth"]) assert.equal(name in LAYOUT, false, name);
});

test("new layout values persist, and invalid saved ones fall back", () => {
  layout.set({ treePinned: true, treeWidth: 320 });
  assert.deepEqual([saved.get(layoutKey("treePinned")), saved.get(layoutKey("treeWidth"))], ["true", "320"]);
  saved.set(layoutKey("treeWidth"), "-1");
  saved.set(layoutKey("treePinned"), "\"yes\"");
  layout.reset();
  assert.deepEqual([layout.get().treeWidth, layout.get().treePinned], [270, false]);
});

test("one workspace toggle opens and closes the workspace", () => {
  layout.reset();
  toggleWorkspace();
  assert.equal(layout.get().workspaceOpen, true);
  toggleWorkspace();
  assert.equal(layout.get().workspaceOpen, false);
});

test("layout reset puts every layout value back", () => {
  layout.set({ workspaceOpen: true, treePinned: true, treeWidth: 400, monitorCollapsed: true });
  resetLayout(null, true);
  const values = layout.get();
  assert.deepEqual([values.workspaceOpen, values.treePinned, values.treeWidth, values.monitorCollapsed], [false, false, LAYOUT.treeWidth, false]);
});
