import assert from "node:assert/strict";
import { test } from "node:test";
import { absolutePath } from "../../../src/workspace/target-paths/absolute-path.ts";
import { resolveReference } from "../../../src/workspace/target-paths/resolve-reference.ts";
import { decodeListing } from "../../../src/workspace/target-paths/decode-listing.ts";
import { validateRequest } from "../../../src/workspace/target-files/validate-request.ts";
import { formatMetadata } from "../../../src/workspace/target-files/format-metadata.ts";
import { DEFAULT_LIMITS_OPTIONS as limits } from "../../../src/config/limits/limits-options.ts";

test("workspace paths have one absolute POSIX spelling", () => {
  for (const path of ["/", "/a", "/space β/file"]) assert.equal(absolutePath(path), path);
  for (const path of ["", "a", "~/a", "~", "/a/", "/a/../b", "//a", "/a\\b", "/a\0b"]) assert.throws(() => absolutePath(path));
});
test("reference tokens resolve once against saved target cwd", () => {
  assert.deepEqual(resolveReference("/project/sub", ""), { directory: "/project/sub", fragment: "" });
  assert.deepEqual(resolveReference("/project/sub", "../Na"), { directory: "/project", fragment: "na" });
  assert.deepEqual(resolveReference("/project/sub", "/.cache/"), { directory: "/.cache", fragment: "" });
  assert.deepEqual(resolveReference("/project", ".hid"), { directory: "/project", fragment: ".hid" });
  assert.throws(() => resolveReference("/project", "~/a"));
});
test("file entrance rejects extra fields and preserves opaque fractional mtime", () => {
  const valid = { sessionId: "owned", target: "owned", path: "/file", content: "", format: "text", expectedLastModified: "mtime:1234.5678" };
  assert.deepEqual(validateRequest("filesWrite", valid, limits), valid);
  for (const changed of [{ target: undefined }, { target: "" }, { path: "relative" }, { expectedLastModified: "2026-01-01" }, { extra: true }, { content: null }, { format: "json" }]) {
    assert.throws(() => validateRequest("filesWrite", { ...valid, ...changed }, limits));
  }
  assert.throws(() => validateRequest("unknown", valid, limits));
  assert.throws(() => validateRequest("filesCreate", { sessionId: "owned", target: "owned", path: "/dir", type: "directory", content: "" }, limits));
  assert.doesNotThrow(() => validateRequest("filesWrite", { ...valid, content: "AA==\n", format: "base64" }, limits));
  assert.throws(() => validateRequest("filesWrite", { ...valid, content: "??", format: "base64" }, limits));
});
test("documented recursive listing payload is exact and bounded by its caller", () => {
  assert.deepEqual(decodeListing(Buffer.from("ddir\0fdir/a\0llink\0"), 3), [{ path: "dir", kind: "directory" }, { path: "dir/a", kind: "file" }, { path: "link", kind: "symlink" }]);
  for (const payload of ["f../a\0", "f/a\0", "fmissing", "xfile\0"]) assert.throws(() => decodeListing(Buffer.from(payload), 1));
  assert.throws(() => decodeListing(Buffer.from("fa\0"), 2));
});
test("mtime projection retains source fractional precision", () => {
  const metadata = formatMetadata({ kind: "file", size: 0, mtimeSec: 1, mtimeNsec: 123456789 }, "/notebook.ipynb");
  assert.equal(metadata.last_modified, "mtime:1123.456789");
  assert.equal(metadata.type, "notebook");
});
