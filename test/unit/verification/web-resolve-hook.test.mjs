import assert from "node:assert/strict";
import test from "node:test";

// The unit runner loads scripts/verification/resolve-web-sources.mjs with --import (see run.mjs).
test("a .js importer reaches a module that was renamed to .ts", async () => {
  const { renamed } = await import("../../fixtures/web-resolve/js-importer.js");
  assert.equal(renamed, "resolved from .ts");
});

test("a missing .js target still fails", async () => {
  await assert.rejects(import("../../fixtures/web-resolve/missing-importer.js"), { code: "ERR_MODULE_NOT_FOUND" });
});
