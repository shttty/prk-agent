import assert from "node:assert/strict";
import test from "node:test";
import { pickerStartDirectory } from "../../../../web/instances/editor/picker-start-directory.js";

test("a picker starts at its own absolute location, the other field's, or root", () => {
  const both = { cwd: " /work/project ", python: " /opt/py/bin/python3 " };
  assert.equal(pickerStartDirectory("directory", both), "/work/project");
  assert.equal(pickerStartDirectory("file", both), "/opt/py/bin");
  assert.equal(pickerStartDirectory("directory", { ...both, cwd: "work/project" }), "/opt/py/bin");
  assert.equal(pickerStartDirectory("file", { ...both, python: "python3" }), "/work/project");
  assert.equal(pickerStartDirectory("directory", { cwd: "", python: "python3" }), "/");
  assert.equal(pickerStartDirectory("file", { cwd: "work/project", python: "" }), "/");
  assert.equal(pickerStartDirectory("file", { ...both, python: "/python3" }), "/");
});
