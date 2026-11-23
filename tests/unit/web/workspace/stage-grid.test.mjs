import assert from "node:assert/strict";
import { test } from "node:test";
import { fitGrid } from "../../../../web/shell/stage/grid/fit-grid.js";
import { splitAxes } from "../../../../web/shell/stage/grid/split-axes.js";
import { mainTests } from "../../../../web/shell/stage/grid/main-tests.js";
import { CHAT_ID, CHAT_VIEW_MIN, holdsChat } from "../../../../web/shell/stage/grid/stage-constants.js";
import { CARD_GAP, CHAT_MIN } from "../../../../web/shell/layout/layout-table.js";

const leaf = (id, views, size) => ({ type: "leaf", data: { id, views, activeView: views[0] }, size });
const branch = (data, size) => ({ type: "branch", data, size });
const CHAT_MAIN = mainTests(null);
const sizes = (node) => (node.type === "leaf" ? { [node.data.id]: node.size } : Object.assign({}, ...node.data.map(sizes)));

// chat | (files above shell), saved in a 1200 x 800 stage
const SAVED = { orientation: "HORIZONTAL", width: 1200, height: 800, root: branch([leaf("c", [CHAT_ID], 680), branch([leaf("f", ["a"], 500), leaf("t", ["terminal:shell"], 300)], 520)], 800) };

test("a wider or narrower stage goes to the chat; the groups beside it keep their width", () => {
  for (const width of [1600, 1000]) {
    const fitted = fitGrid(SAVED, width, 800, CHAT_MAIN);
    assert.deepEqual([fitted.width, fitted.root.data[0].size, fitted.root.data[1].size], [width, width - 520, 520]);
  }
});

test("height along the other axis is shared by the column's groups in proportion", () => {
  const fitted = fitGrid(SAVED, 1200, 1000, CHAT_MAIN);
  assert.deepEqual(sizes(fitted.root), { c: 680, f: 625, t: 375 });
  assert.equal(fitted.root.size, 1000);
});

test("the chat card keeps its floor: the others give way together", () => {
  const fitted = fitGrid(SAVED, 700, 800, CHAT_MAIN);
  assert.equal(CHAT_VIEW_MIN.width, CHAT_MIN + CARD_GAP, "the floor is the card's, around which the view pads half a gap");
  assert.equal(fitted.root.data[0].size, CHAT_VIEW_MIN.width);
  assert.equal(fitted.root.data[1].size, 700 - CHAT_VIEW_MIN.width);
});

test("a size left open takes the rest instead of the chat (a fixed chat column)", () => {
  const preset = { orientation: "HORIZONTAL", width: 0, height: 0, root: branch([leaf("w", ["a"], null), leaf("c", [CHAT_ID], 420)], null) };
  const fitted = fitGrid(preset, 1400, 900, CHAT_MAIN);
  assert.deepEqual([fitted.root.data[0].size, fitted.root.data[1].size, fitted.root.size], [980, 420, 900]);
});

test("the input grid is not changed", () => {
  const before = JSON.stringify(SAVED);
  fitGrid(SAVED, 1500, 700, CHAT_MAIN);
  assert.equal(JSON.stringify(SAVED), before);
});

test("a workspace group as the main area takes the difference; the chat keeps its width", () => {
  const fitted = fitGrid(SAVED, 1600, 800, mainTests("f"));
  assert.deepEqual([fitted.root.data[0].size, fitted.root.data[1].size], [680, 920]);
});

test("each group is held along the split that separates it from the main area", () => {
  assert.deepEqual([...splitAxes(SAVED, holdsChat)].sort(), [["f", "x"], ["t", "x"]]);
  assert.deepEqual([...splitAxes(SAVED, mainTests("f").isMain)].sort(), [["c", "x"], ["t", "y"]], "the files group as main: the chat keeps its width, the shell under it its height");
  // (chat | files) above a shell: the files beside the chat keep their width, the shell under both its height
  const stacked = { orientation: "VERTICAL", root: branch([branch([leaf("c", [CHAT_ID], 600), leaf("f", ["a"], 400)], 500), leaf("t", ["terminal:shell"], 300)], 1000) };
  assert.deepEqual([...splitAxes(stacked, holdsChat)].sort(), [["f", "x"], ["t", "y"]]);
});
