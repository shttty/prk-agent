// The layout store reads globalThis.localStorage on use: give it one before anything touches it.
// ── saved layout ──
// a diff tab is a tab of its own: it may share its file's path, it is not a file to read, and each file has one
// layout reset: every tab into one group, order kept, the active tab stays active
// ── placement and path bookkeeping ──
// ── directory list ──
import assert from "node:assert/strict";
import { DIFF_COMPONENT } from "../../../web/workspace/editor-layout/editor-layout-constants.js";
import { FILE_COMPONENT } from "../../../web/workspace/editor-layout/editor-layout-constants.js";
import { editorLayoutKey } from "../../../web/workspace/editor-layout/editor-layout-key.js";
import { findPanelByPath } from "../../../web/workspace/editor-layout/find-panel-by-path.js";
import { mergeSavedLayout } from "../../../web/workspace/editor-layout/merge-saved-layout.js";
import { panelsWithin } from "../../../web/workspace/editor-layout/panels-within.js";
import { parseSavedLayout } from "../../../web/workspace/editor-layout/parse-saved-layout.js";
import { placementFor } from "../../../web/workspace/editor-layout/placement-for.js";
import { renameChanges } from "../../../web/workspace/editor-layout/rename-changes.js";
import { savedPaths } from "../../../web/workspace/editor-layout/saved-paths.js";
import { serializeLayout } from "../../../web/workspace/editor-layout/serialize-layout.js";
import { joinPath } from "../../../web/workspace/file-paths/join-path.js";
import { parentOf } from "../../../web/workspace/file-paths/parent-of.js";
import { pathItems } from "../../../web/workspace/file-paths/path-items.js";
import { remapPath } from "../../../web/workspace/file-paths/remap-path.js";
import { visibleEntries } from "../../../web/workspace/file-paths/visible-entries.js";
import { within } from "../../../web/workspace/file-paths/within.js";

export async function checkLayoutAndPaths(ctx) {
Object.defineProperties(ctx, {
    saved: { configurable: true, get: () => saved },
    layoutModule: { configurable: true, get: () => layoutModule },
    LAYOUT: { configurable: true, get: () => LAYOUT },
    layoutStore: { configurable: true, get: () => layoutStore },
    layoutKey: { configurable: true, get: () => layoutKey },
    CARD_GAP: { configurable: true, get: () => CARD_GAP },
    CHAT_MIN: { configurable: true, get: () => CHAT_MIN },
    SESSION_MAX: { configurable: true, get: () => SESSION_MAX },
    SESSION_MIN: { configurable: true, get: () => SESSION_MIN },
    TREE_MIN: { configurable: true, get: () => TREE_MIN },
    fitWidths: { configurable: true, get: () => fitWidths },
    settle: { configurable: true, get: () => settle },
});

const saved = new Map();

globalThis.localStorage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)), removeItem: (key) => saved.delete(key) };

const layoutModule = import.meta.resolve("../../../web/shell/layout/layout-store.js");

const { LAYOUT, layout: layoutStore, layoutKey } = await import(layoutModule);

const { CARD_GAP, CHAT_MIN, SESSION_MAX, SESSION_MIN, TREE_MIN } = await import("../../../web/shell/layout/layout-table.js");

const { fitWidths } = await import("../../../web/shell/layout/fit-widths.js");

const panel = (id, path) => ({ id, contentComponent: FILE_COMPONENT, tabComponent: FILE_COMPONENT, params: { path }, title: path });

const leaf = (id, views, activeView = views[0]) => ({ type: "leaf", data: { id, views, activeView }, size: 100 });

const layout = (root, panels) => ({ grid: { root, width: 800, height: 600, orientation: "HORIZONTAL" }, panels, activeGroup: "1" });

const TWO = layout({ type: "branch", data: [leaf("1", ["a"]), leaf("2", ["b", "c"], "c")], size: 600 }, { a: panel("a", "x/one.py"), b: panel("b", "two.md"), c: panel("c", "three.txt") });

assert.equal(editorLayoutKey("w1"), "pi.editor.v4.w1");

const restored = parseSavedLayout(serializeLayout(TWO));

assert.deepEqual(restored, TWO, "a layout this module wrote restores unchanged");

assert.deepEqual(savedPaths(restored).sort(), ["three.txt", "two.md", "x/one.py"]);

assert.deepEqual(parseSavedLayout(JSON.stringify({ ...TWO, floatingGroups: [{ x: 1 }], edgeGroups: { bottom: {} }, popoutGroups: [] })), TWO, "only the grid is kept");

{
  const diffPanel = (id, path) => ({ ...panel(id, path), contentComponent: DIFF_COMPONENT, tabComponent: DIFF_COMPONENT });
  const withDiff = layout(leaf("1", ["a", "d"]), { a: panel("a", "x/one.py"), d: diffPanel("d", "x/one.py") });
  const parsed = parseSavedLayout(serializeLayout(withDiff));
  assert.deepEqual(parsed, withDiff, "a file tab and its diff tab restore together");
  assert.deepEqual(savedPaths(parsed), ["x/one.py"], "only file tabs are files to load");
  assert.equal(parseSavedLayout(serializeLayout(layout(leaf("1", ["d", "e"]), { d: diffPanel("d", "x/one.py"), e: diffPanel("e", "x/one.py") }))), null, "two diff tabs of one file are not a layout this module wrote");
}

const broken = {
  "not json": "{nope",
  "not an object": "[]",
  "no panels": serializeLayout(layout({ type: "leaf", data: { id: "1", views: [], activeView: undefined }, size: 1 }, {})),
  "foreign component": serializeLayout({ ...TWO, panels: { ...TWO.panels, a: { ...panel("a", "x/one.py"), contentComponent: "chat" } } }),
  "grid names a missing panel": serializeLayout(layout(leaf("1", ["a", "ghost"]), { a: panel("a", "p") })),
  "panel not in the grid": serializeLayout(layout(leaf("1", ["a"]), { a: panel("a", "p"), b: panel("b", "q") })),
  "panel in two groups": serializeLayout(layout({ type: "branch", data: [leaf("1", ["a"]), leaf("2", ["a"])], size: 1 }, { a: panel("a", "p") })),
  "same file twice": serializeLayout(layout(leaf("1", ["a", "b"]), { a: panel("a", "p"), b: panel("b", "p") })),
  "active view outside the group": serializeLayout(layout(leaf("1", ["a"], "zzz"), { a: panel("a", "p") })),
  "panel id differs from its key": serializeLayout(layout(leaf("1", ["a"]), { a: panel("other", "p") })),
  "no path": serializeLayout(layout(leaf("1", ["a"]), { a: { ...panel("a", "p"), params: {} } })),
  "empty branch": serializeLayout(layout({ type: "branch", data: [], size: 1 }, { a: panel("a", "p") })),
};

for (const [name, raw] of Object.entries(broken)) assert.equal(parseSavedLayout(raw), null, `rejects: ${name}`);

{
  const merged = parseSavedLayout(mergeSavedLayout(serializeLayout(TWO)));
  assert.ok(merged, "the merged layout is a valid saved layout");
  const groups = merged.grid.root.data;
  assert.equal(groups.length, 1);
  assert.deepEqual([groups[0].data.views, groups[0].data.activeView, merged.activeGroup], [["a", "b", "c"], "a", "1"], "tabs in group order, active tab of the active group");
  const secondActive = parseSavedLayout(mergeSavedLayout(serializeLayout({ ...TWO, activeGroup: "2" })));
  assert.equal(secondActive.grid.root.data[0].data.activeView, "c", "the active tab of the other group stays active");
  assert.deepEqual(merged.panels, TWO.panels, "no tab is dropped or changed");
  assert.equal(mergeSavedLayout("{nope"), null);
}

assert.deepEqual(placementFor(["1", "2"], "2"), { referenceGroup: "2" }, "the active group");

assert.deepEqual(placementFor(["1", "2"], "gone"), { referenceGroup: "1" }, "a stale active group falls back to the first");

assert.deepEqual(placementFor(["1"], undefined), { referenceGroup: "1" }, "no active group still names one");

assert.equal(placementFor([], "1"), null, "no group yet: nothing to name");

const open = [{ id: "a", path: "/w/src/a.py" }, { id: "b", path: "/w/src/deep/b.py" }, { id: "c", path: "/w/src2/c.py" }, { id: "d", path: "/w/README.md" }];

assert.equal(findPanelByPath(open, "/w/README.md"), "d");

assert.equal(findPanelByPath(open, "/w/nope"), null);

assert.deepEqual(renameChanges(open, "/w/src", "/w/lib"), [{ id: "a", path: "/w/lib/a.py" }, { id: "b", path: "/w/lib/deep/b.py" }], "a folder rename moves what is inside, not siblings with the same prefix");

assert.deepEqual(renameChanges(open, "/w/README.md", "/w/docs/README.md"), [{ id: "d", path: "/w/docs/README.md" }]);

assert.deepEqual(panelsWithin(open, "/w/src"), ["a", "b"]);

assert.deepEqual(panelsWithin(open, "/w/src/a.py"), ["a"]);

assert.equal(remapPath("/w/src2/c.py", "/w/src", "/w/lib"), "/w/src2/c.py");

assert.equal(within("/w/src", "/w/src"), true);

// the target root "/" is an ordinary directory: no doubled slash, no lost first character, no parent above it
assert.equal(remapPath("/etc/hosts", "/", "/x"), "/x/etc/hosts");
assert.equal(remapPath("/a/b", "/a", "/"), "/b");
assert.equal(within("/etc", "/"), true);
assert.equal(within("/etcetera", "/etc"), false);
assert.deepEqual([joinPath("/", "a"), joinPath("/a", "b"), parentOf("/"), parentOf("/a"), parentOf("/a/b")], ["/a", "/a/b", "/", "/", "/a"]);

const entries = [{ name: ".env" }, { name: "Data.csv" }, { name: "data_old" }, { name: "notes.md" }];

assert.deepEqual(visibleEntries(entries).map((entry) => entry.name), ["Data.csv", "data_old", "notes.md"], "dotfiles hidden by default");

assert.deepEqual(visibleEntries(entries, { showHidden: true }).length, 4);

assert.deepEqual(visibleEntries(entries, { query: " DATA " }).map((entry) => entry.name), ["Data.csv", "data_old"], "filter is a case-insensitive substring on the name");

assert.deepEqual(visibleEntries(entries, { query: "env" }), [], "a dotfile stays hidden even when the filter matches it");

assert.deepEqual(pathItems("/data/a"), [{ label: "/", path: "/" }, { label: "data", path: "/data" }, { label: "a", path: "/data/a" }]);

assert.deepEqual(pathItems("/"), [{ label: "/", path: "/" }]);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

}
