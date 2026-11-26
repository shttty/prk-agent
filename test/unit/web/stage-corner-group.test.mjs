import assert from "node:assert/strict";
import test from "node:test";
import { cornerGroup } from "../../../web/shell/stage/grid/corner-group.js";

const leaf = (id, visible) => ({ type: "leaf", data: { id, views: [] }, size: 100, ...(visible === undefined ? {} : { visible }) });
const branch = (...data) => ({ type: "branch", data, size: 100 });

test("the top-right group is the last shown group along a row and the first down a column", () => {
  assert.equal(cornerGroup({ orientation: "HORIZONTAL", root: branch(leaf("chat"), leaf("files")) }), "files");
  assert.equal(cornerGroup({ orientation: "HORIZONTAL", root: branch(leaf("files"), leaf("chat")) }), "chat");
  assert.equal(cornerGroup({ orientation: "VERTICAL", root: branch(leaf("chat"), leaf("shell")) }), "chat");
  assert.equal(cornerGroup({ orientation: "HORIZONTAL", root: branch(leaf("files"), branch(leaf("chat"), leaf("shell"))) }), "chat");
  assert.equal(cornerGroup({ orientation: "HORIZONTAL", root: branch(leaf("chat"), leaf("files", false)) }), "chat");
  assert.equal(cornerGroup({ orientation: "HORIZONTAL", root: leaf("chat") }), "chat");
});
