import assert from "node:assert/strict";
import { test } from "node:test";
import { measurable } from "../../../../web/workspace/terminal/measurable.js";
import { fitTerminal } from "../../../../web/workspace/terminal/fit-terminal.js";

const host = (over = {}) => ({ offsetParent: {}, clientWidth: 600, clientHeight: 400, ...over });

test("a laid-out host of a usable size can be fitted", () => {
  assert.equal(measurable(host()), true);
  assert.equal(measurable(host({ clientWidth: 20, clientHeight: 20 })), true);
});

test("hidden or sliver-sized hosts are never fitted, so no bogus size reaches the PTY", () => {
  for (const over of [{ offsetParent: null }, { clientWidth: 19 }, { clientHeight: 19 }, { clientWidth: 0, clientHeight: 0 }]) {
    let fitted = 0;
    fitTerminal(host(over), { fit: () => { fitted += 1; } });
    assert.equal(fitted, 0, JSON.stringify(over));
  }
  assert.equal(measurable(null), false);
  let fitted = 0;
  fitTerminal(host(), { fit: () => { fitted += 1; } });
  assert.equal(fitted, 1);
});
