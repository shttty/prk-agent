import assert from "node:assert/strict";
import { test } from "node:test";

const saved = new Map();
globalThis.localStorage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)), removeItem: (key) => saved.delete(key) };
const { arrangeByPreset } = await import("../../../../web/shell/stage/presets/arrange-by-preset.js");
const { presetOf } = await import("../../../../web/shell/stage/presets/preset-of.js");
const { BUILTIN_PRESETS } = await import("../../../../web/shell/stage/presets/builtin-presets.js");
const { layoutNameProblem } = await import("../../../../web/shell/stage/presets/layout-name-problem.js");
const { parsePresets } = await import("../../../../web/shell/stage/presets/parse-presets.js");
const { CHAT_ID } = await import("../../../../web/shell/stage/grid/stage-constants.js");
const { PRESETS_KEY, layout, readPresets, savePresets } = await import("../../../../web/shell/layout/layout-store.js");
const { placeByPreset } = await import("../../../../web/shell/stage/presets/place-by-preset.js");
const { removePreset } = await import("../../../../web/shell/stage/presets/remove-preset.js");

const [ONE, TWO] = BUILTIN_PRESETS.map((preset) => preset.layout);
const panel = (id, contentComponent, params) => ({ id, contentComponent, tabComponent: contentComponent, params, title: id });
const PANELS = {
  [CHAT_ID]: panel(CHAT_ID, "chat", {}),
  a: panel("a", "file", { path: "/w/a.py" }), d: panel("d", "diff", { path: "/w/a.py" }), b: panel("b", "file", { path: "/w/b.md" }),
  "terminal:shell": panel("terminal:shell", "terminal", { name: "shell" }), "terminal:shell-2": panel("terminal:shell-2", "terminal", { name: "shell-2" }),
};
const leaf = (id, views, activeView, size) => ({ type: "leaf", data: { id, views, activeView }, size });
// terminal left of the chat; right of it: files above a mixed group (file + second shell)
const CURRENT = {
  grid: { orientation: "HORIZONTAL", width: 1400, height: 900, root: { type: "branch", size: 900, data: [
    leaf("t", ["terminal:shell"], "terminal:shell", 300),
    leaf("c", [CHAT_ID], CHAT_ID, 600),
    { type: "branch", size: 500, data: [leaf("f", ["a", "d"], "d", 450), leaf("m", ["b", "terminal:shell-2"], "terminal:shell-2", 450)] },
  ] } },
  panels: PANELS,
  activeGroup: "m",
};
const groups = (node) => (node.type === "leaf" ? [node.data] : node.data.flatMap(groups));
const arrange = (...args) => arrangeByPreset(...args).dockview;
const workGroups = (result) => groups(result.grid.root).filter((group) => !group.views.includes(CHAT_ID));
const sizesSum = (node) => node.data.reduce((sum, child) => sum + child.size, 0);

test("built-in 1: every open tab into one group right of the chat, tab order and shown tabs kept, nothing dropped", () => {
  const result = arrange(ONE, CURRENT, 1400, 900);
  assert.equal(result.grid.root.data[0].data.views[0], CHAT_ID, "the chat is left");
  const [work] = workGroups(result);
  assert.deepEqual(work.views, ["terminal:shell", "a", "d", "b", "terminal:shell-2"], "groups in grid order, each keeps its tab order");
  assert.equal(work.activeView, "terminal:shell-2", "the shown tab of the active group stays shown");
  assert.equal(result.activeGroup, work.id);
  assert.equal(result.panels, PANELS, "the same panels: reused, not rebuilt");
  assert.deepEqual([result.grid.root.data[1].size, sizesSum(result.grid.root)], [522, 1400], "the group keeps its width, the chat takes the rest");
});

test("built-in 2: the workspace on the left takes the room, the chat is a fixed column on the right", () => {
  const result = arrange(TWO, CURRENT, 1400, 900);
  const [left, right] = result.grid.root.data;
  assert.equal(right.data.views[0], CHAT_ID);
  assert.deepEqual([left.size, right.size], [1400 - 428, 428]);
  assert.equal(right.data.locked && right.data.hideHeader, true, "the chat's group stays locked without a header");
});

test("a saved layout puts each kind into its own group again, in another session's tabs", () => {
  const saved = presetOf(CURRENT, true, null);
  assert.equal(JSON.stringify(saved).includes("/w/"), false, "a layout records no file or shell");
  const other = { ...CURRENT, grid: { ...CURRENT.grid, root: { type: "branch", size: 900, data: [leaf("c", [CHAT_ID], CHAT_ID, 800), leaf("x", ["terminal:shell", "a"], "a", 600)] } }, activeGroup: "x" };
  const result = arrange(saved, other, 1400, 900);
  const [first, , rest] = result.grid.root.data;
  assert.deepEqual(first.data.views, ["terminal:shell"], "shells go to the first shell group (left of the chat)");
  assert.deepEqual(groups(rest).map((group) => group.views), [["a"]], "files to the first files group; the mixed group has nothing left and is dropped");
  assert.equal(rest.type, "leaf", "a branch left with one group collapses into it");
  assert.equal(result.grid.root.data[0].size, 300, "kept widths beside the chat");
});

test("a kind the layout has no group for goes to its largest group", () => {
  const filesOnly = { orientation: "HORIZONTAL", workspaceOpen: true, root: { type: "branch", size: null, data: [
    { type: "leaf", kinds: ["chat"], size: null }, { type: "leaf", kinds: ["files"], size: 200 }, { type: "leaf", kinds: ["files"], size: 600 },
  ] } };
  const result = arrange(filesOnly, CURRENT, 1400, 900);
  const views = workGroups(result).map((group) => group.views);
  assert.deepEqual(views, [["a", "d"], ["terminal:shell", "b", "terminal:shell-2"]], "the larger files group takes the later file group and every shell, in grid order");
});

test("a layout without workspace groups still keeps every tab (arranged like built-in 1)", () => {
  const chatOnly = { orientation: "HORIZONTAL", workspaceOpen: false, root: { type: "branch", size: null, data: [{ type: "leaf", kinds: ["chat"], size: null }] } };
  assert.equal(workGroups(arrange(chatOnly, CURRENT, 1400, 900))[0].views.length, 5);
});

test("names: empty and taken (built-in included) are refused; built-ins cannot be saved over or deleted", () => {
  const list = [{ name: "写代码", layout: ONE }];
  assert.deepEqual([layoutNameProblem("  ", list), layoutNameProblem("写代码", list), layoutNameProblem(BUILTIN_PRESETS[0].name, list), layoutNameProblem(" 看日志 ", list)], ["empty", "taken", "taken", null]);
});

test("saved layouts live in one registered key, in save order; damaged entries are skipped", () => {
  savePresets([{ name: "b", layout: TWO }, { name: "a", layout: ONE }, { name: "bad", layout: { orientation: "HORIZONTAL", root: { type: "branch", data: [] } } }]);
  assert.ok(saved.has(PRESETS_KEY));
  assert.deepEqual(parsePresets(readPresets()).map((entry) => entry.name), ["b", "a"]);
  assert.deepEqual(parsePresets(readPresets().filter((entry) => entry.name !== "b")).map((entry) => entry.name), ["a"], "deleting one keeps the others");
});

test("the main area: built-in 2 marks the workspace, a saved layout records the main area of the moment", () => {
  assert.match(arrangeByPreset(TWO, CURRENT, 1400, 900).main, /^layout-/, "built-in 2: the workspace group is the main area");
  assert.equal(arrangeByPreset(ONE, CURRENT, 1400, 900).main, null, "built-in 1: the chat");
  const saved = presetOf(CURRENT, true, "f");
  const { dockview, main } = arrangeByPreset(saved, CURRENT, 1600, 900);
  assert.equal(groups(dockview.grid.root).find((group) => group.id === main)?.views.join(), "a,d", "the files group is main again");
  assert.deepEqual(dockview.grid.root.data.slice(0, 2).map((node) => node.size), [300, 600], "a wider stage goes to the main area; the chat keeps its width");
  const empty = { ...CURRENT, grid: { ...CURRENT.grid, root: { type: "branch", size: 900, data: [leaf("c", [CHAT_ID], CHAT_ID, 1400)] } } };
  assert.equal(arrangeByPreset(TWO, empty, 1400, 900).main, null, "a main area left without panels falls back to the chat");
});

test("new tabs land by the last layout: into a group that can be its group, else a new group on its side", () => {
  const live = (groups) => ({ chat: "c", active: null, groups });
  const size = { width: 1400, height: 900 };
  assert.deepEqual(placeByPreset(ONE, "terminal", live([{ id: "f", kinds: ["files"] }]), size), { position: { referenceGroup: "f" } }, "built-in 1: one group for both kinds");
  assert.deepEqual(placeByPreset(ONE, "files", live([]), size), { position: { referenceGroup: "c", direction: "right" }, initialWidth: 522 });
  assert.deepEqual(placeByPreset(TWO, "terminal", live([]), size), { position: { referenceGroup: "c", direction: "left" }, initialWidth: 1400 - 428 }, "built-in 2: left of the chat, taking the room");
  const split = presetOf(CURRENT, true, null); // shells left of the chat, files right (above a mixed group)
  assert.deepEqual(placeByPreset(split, "terminal", live([{ id: "x", kinds: ["files"] }]), size), { position: { referenceGroup: "c", direction: "left" }, initialWidth: 300 }, "a files-only group is not the shell group");
  assert.deepEqual(placeByPreset(split, "files", live([{ id: "x", kinds: ["files"] }, { id: "y", kinds: ["files"] }]), size).position.referenceGroup, "x");
  assert.equal(placeByPreset(ONE, "files", { chat: "c", active: "t", groups: [{ id: "f", kinds: ["files", "terminal"] }, { id: "t", kinds: ["terminal"] }] }, size).position.referenceGroup, "f", "a file joins a group holding files before the active shell-only one");
  const filesOnly = { orientation: "VERTICAL", workspaceOpen: true, root: { type: "branch", size: null, data: [{ type: "leaf", kinds: ["chat"], size: null, main: true }, { type: "leaf", kinds: ["files"], size: 300 }] } };
  assert.deepEqual(placeByPreset(filesOnly, "terminal", live([]), size), { position: { referenceGroup: "c", direction: "below" }, initialHeight: 300 }, "no shell group: the largest group's place");
});

test("deleting the layout applied last makes built-in 1 the one new tabs follow", () => {
  const list = [{ name: "a", layout: ONE }, { name: "b", layout: TWO }];
  layout.set({ lastPreset: "saved:b" });
  assert.deepEqual(removePreset(list, "a").map((entry) => entry.name), ["b"]);
  assert.equal(layout.get().lastPreset, "saved:b", "another one deleted: unchanged");
  removePreset(list, "b");
  assert.equal(layout.get().lastPreset, BUILTIN_PRESETS[0].id);
  assert.deepEqual(parsePresets(readPresets()).map((entry) => entry.name), ["a"]);
});
