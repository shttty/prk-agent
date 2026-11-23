import assert from "node:assert/strict";
import { test } from "node:test";
import { fitPreferred } from "../../../../web/shell/stage/grid/fit-preferred.js";
import { leafExtents } from "../../../../web/shell/stage/grid/leaf-extents.js";
import { preferredSizes } from "../../../../web/shell/stage/grid/preferred-sizes.js";
import { CHAT_ID, CHAT_VIEW_MIN } from "../../../../web/shell/stage/grid/stage-constants.js";

// The stage grid at 1440 (session sidebar open) is 1160 wide; at 1024 it is 744.
const WIDE = 1160;
const NARROW = 744;
const HEIGHT = 892;
const leaf = (id, views, size) => ({ type: "leaf", data: { id, views, activeView: views[0] }, size });
const grid = (children) => ({ orientation: "HORIZONTAL", width: WIDE, height: HEIGHT, root: { type: "branch", size: HEIGHT, data: children } });
const widths = (laid) => Object.fromEntries(Object.entries(leafExtents(laid)).map(([id, size]) => [id, size.width]));
const near = (actual, expected, label) => { for (const id of Object.keys(expected)) assert.ok(Math.abs(actual[id] - expected[id]) <= 1, `${label}: ${id} ${actual[id]} vs ${expected[id]}`); };

/** One window round trip as the stage does it: the resize is passive for the preferences, each size is laid out from
 * them (refitPreferred), and the user's own layout changes in between are observed. */
function roundTrip(start, main, anchor, sizing) {
  sizing.squeezing();
  const narrow = fitPreferred(start, sizing.get(), NARROW, HEIGHT, main);
  sizing.observe(leafExtents(narrow), anchor);
  const back = fitPreferred({ ...narrow, width: WIDE }, sizing.get(), WIDE, HEIGHT, main);
  sizing.settle(leafExtents(back));
  return { narrow: widths(narrow), back: widths(back) };
}

test("layout 1: 1440 -> 1024 -> 1440, the workspace group is squeezed under the chat's floor and gets its width back", () => {
  const start = grid([leaf("c", [CHAT_ID], WIDE - 522), leaf("w", ["a"], 522)]);
  const sizing = preferredSizes({ w: leafExtents(start).w });
  sizing.set(sizing.get(), leafExtents(start));
  const { narrow, back } = roundTrip(start, null, "c", sizing);
  near(narrow, { c: CHAT_VIEW_MIN.width, w: NARROW - CHAT_VIEW_MIN.width }, "1024: the chat stops at its floor, then the workspace gives way");
  near(back, { c: WIDE - 522, w: 522 }, "back at 1440: the workspace group first, the chat the rest");
  assert.equal(sizing.get().w.width, 522, "a squeeze does not change the preference");
});

test("layout 1: after a handle drag the round trip returns to the dragged width", () => {
  const start = grid([leaf("c", [CHAT_ID], WIDE - 522), leaf("w", ["a"], 522)]);
  const sizing = preferredSizes({ w: leafExtents(start).w });
  sizing.set(sizing.get(), leafExtents(start));
  const dragged = grid([leaf("c", [CHAT_ID], WIDE - 640), leaf("w", ["a"], 640)]);
  sizing.observe(leafExtents(dragged), "c"); // the handle drag: a layout change that is not a squeeze
  assert.equal(sizing.get().w.width, 640);
  const { back } = roundTrip(dragged, null, "c", sizing);
  near(back, { c: WIDE - 640, w: 640 }, "back at 1440 after the drag");
});

test("layout 2: the workspace is the main area; the chat column keeps its width, squeezed only under the main area's floor", () => {
  const start = grid([leaf("w", ["a"], WIDE - 428), leaf("c", [CHAT_ID], 428)]);
  const sizing = preferredSizes({ c: leafExtents(start).c });
  sizing.set(sizing.get(), leafExtents(start));
  const { narrow, back } = roundTrip(start, "w", "w", sizing);
  near(narrow, { w: NARROW - 428, c: 428 }, "1024: the workspace absorbs it all");
  near(back, { w: WIDE - 428, c: 428 }, "back at 1440");
  sizing.squeezing();
  const tight = fitPreferred(start, sizing.get(), 500, HEIGHT, "w");
  sizing.observe(leafExtents(tight), "w");
  assert.ok(widths(tight).c < 428, "under the workspace's floor the chat column gives way");
  const again = fitPreferred({ ...tight, width: WIDE }, sizing.get(), WIDE, HEIGHT, "w");
  sizing.settle(leafExtents(again));
  near(widths(again), { w: WIDE - 428, c: 428 }, "and gets its 428 back first as the room returns");
});

test("several squeezed groups each get back what they are owed before the main area grows", () => {
  const start = grid([leaf("c", [CHAT_ID], WIDE - 300 - 250), leaf("f", ["a"], 300), leaf("t", ["terminal:shell"], 250)]);
  const sizing = preferredSizes({ f: leafExtents(start).f, t: leafExtents(start).t });
  sizing.set(sizing.get(), leafExtents(start));
  const { narrow, back } = roundTrip(start, null, "c", sizing);
  assert.ok(narrow.f < 300 && narrow.t < 250 && Math.abs(narrow.f / narrow.t - 300 / 250) < 0.02, `both give way in proportion (${narrow.f}, ${narrow.t})`);
  near(back, { c: WIDE - 550, f: 300, t: 250 }, "back at 1440");
});
