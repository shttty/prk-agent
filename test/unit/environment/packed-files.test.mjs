import assert from "node:assert/strict";
import test from "node:test";
import { readPackedFiles } from "../../../src/remote-extensions/bundle/packages/read-packed-files.ts";

// `npm pack --dry-run --json` for the same two-file package, trimmed from real npm 11.19.0 and 12.2.1 output.
const files = [{ path: "lib/a.js", size: 17, mode: 420 }, { path: "package.json", size: 73, mode: 420 }];
const npm11 = JSON.stringify([{ id: "probe-pkg@1.2.3", name: "probe-pkg", version: "1.2.3", filename: "probe-pkg-1.2.3.tgz", files, entryCount: 2, bundled: [] }]);
const npm12 = JSON.stringify({ "probe-pkg": { id: "probe-pkg@1.2.3", name: "probe-pkg", version: "1.2.3", filename: "probe-pkg-1.2.3.tgz", files, entryCount: 2, bundled: [] } });

test("packed file paths come out of the npm 11 array and the npm 12 package-keyed object alike", () => {
  assert.deepEqual(readPackedFiles(npm11), ["lib/a.js", "package.json"]);
  assert.deepEqual(readPackedFiles(npm12), ["lib/a.js", "package.json"]);
  assert.deepEqual(readPackedFiles(JSON.stringify({ empty: { files: [] } })), []);
});

test("an output that is neither shape is refused instead of read as an empty package", () => {
  for (const output of ["", "npm warn something", "[]", "{}", "null", JSON.stringify({ a: { files }, b: { files } }),
    JSON.stringify([{ files }, { files }]), JSON.stringify({ "probe-pkg": { name: "probe-pkg" } }), JSON.stringify({ "probe-pkg": { files: [{ size: 1 }] } })]) {
    assert.equal(readPackedFiles(output), undefined, output);
  }
});
