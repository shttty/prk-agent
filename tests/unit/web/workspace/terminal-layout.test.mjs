import assert from "node:assert/strict";
import { test } from "node:test";
import { DIFF_COMPONENT, FILE_COMPONENT, TERMINAL_COMPONENT } from "../../../../web/workspace/editor-layout/editor-layout-constants.js";
import { mergeSavedLayout } from "../../../../web/workspace/editor-layout/merge-saved-layout.js";
import { parseSavedLayout } from "../../../../web/workspace/editor-layout/parse-saved-layout.js";
import { savedPaths } from "../../../../web/workspace/editor-layout/saved-paths.js";
import { serializeLayout } from "../../../../web/workspace/editor-layout/serialize-layout.js";
import { terminalPanelId } from "../../../../web/workspace/editor-layout/terminal-panel-id.js";
import { nextShellName } from "../../../../web/workspace/terminal/next-shell-name.js";

const file = (id, path) => ({ id, contentComponent: FILE_COMPONENT, tabComponent: FILE_COMPONENT, params: { path }, title: path });
const shell = (name, over = {}) => ({ id: terminalPanelId(name), contentComponent: TERMINAL_COMPONENT, tabComponent: TERMINAL_COMPONENT, params: { name }, title: name, renderer: "onlyWhenVisible", ...over });
const leaf = (id, views, activeView = views[0]) => ({ type: "leaf", data: { id, views, activeView }, size: 100 });
const layout = (root, panels, activeGroup = "1") => ({ grid: { root, width: 800, height: 600, orientation: "HORIZONTAL" }, panels, activeGroup });
const panelsOf = (...list) => Object.fromEntries(list.map((panel) => [panel.id, panel]));

// One group with a file and two shells; and a split: file | shell above shell.
const SAME_GROUP = layout(leaf("1", ["a", "terminal:shell", "terminal:shell-2"]), panelsOf(file("a", "x.py"), shell("shell"), shell("shell-2")));
const SPLIT = layout({ type: "branch", data: [leaf("1", ["a"]), { type: "branch", data: [leaf("2", ["terminal:shell"]), leaf("3", ["terminal:shell-2"])], size: 300 }], size: 600 }, panelsOf(file("a", "x.py"), shell("shell"), shell("shell-2")));

test("a layout with several shell tabs restores, in one group and split", () => {
  for (const saved of [SAME_GROUP, SPLIT]) assert.deepEqual(parseSavedLayout(serializeLayout(saved)), saved);
});

test("every shell panel is restored inside its group, also from a layout saved as dockview's always-rendered overlay", () => {
  for (const renderer of [undefined, "always"]) {
    const parsed = parseSavedLayout(serializeLayout(layout(leaf("1", ["terminal:shell"]), panelsOf(shell("shell", { renderer })))));
    assert.equal(parsed.panels["terminal:shell"].renderer, "onlyWhenVisible", `saved renderer ${renderer}`);
  }
});

test("a shell has a name, its panel id says it, and shells are not files to load", () => {
  assert.deepEqual(savedPaths(parseSavedLayout(serializeLayout(SAME_GROUP))), ["x.py"]);
  assert.equal(parseSavedLayout(serializeLayout(layout(leaf("1", ["t"]), { t: shell("shell", { id: "t" }) }))), null, "the id must be terminal:<name>");
  assert.equal(parseSavedLayout(serializeLayout(layout(leaf("1", ["terminal:x"]), panelsOf(shell("x", { params: {} }))))), null, "a shell panel without its name");
  assert.equal(parseSavedLayout(serializeLayout(layout(leaf("1", ["terminal:x"]), panelsOf(shell("x", { params: { name: "y" } }))))), null, "name and id disagree");
});

test("a diff tab and a shell tab live together", () => {
  const diff = { ...file("d", "x.py"), contentComponent: DIFF_COMPONENT, tabComponent: DIFF_COMPONENT };
  const parsed = parseSavedLayout(serializeLayout(layout(leaf("1", ["d", "terminal:shell"]), panelsOf(diff, shell("shell")))));
  assert.deepEqual(Object.keys(parsed.panels).sort(), ["d", "terminal:shell"]);
});

test("layout reset merges split shell groups back without dropping a shell or a file", () => {
  const merged = parseSavedLayout(mergeSavedLayout(serializeLayout(SPLIT)));
  assert.ok(merged);
  assert.equal(merged.grid.root.data.length, 1);
  assert.deepEqual(merged.grid.root.data[0].data.views.sort(), ["a", "terminal:shell", "terminal:shell-2"]);
  assert.deepEqual(Object.keys(merged.panels).sort(), ["a", "terminal:shell", "terminal:shell-2"]);
});

test("a new shell gets the first free name", () => {
  assert.equal(nextShellName([]), "shell");
  assert.equal(nextShellName(["shell"]), "shell-2");
  assert.equal(nextShellName(["shell", "shell-3"]), "shell-2");
  assert.equal(nextShellName(["shell-2"]), "shell");
});
