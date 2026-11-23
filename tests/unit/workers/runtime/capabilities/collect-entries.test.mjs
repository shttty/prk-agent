import assert from "node:assert/strict";
import { test } from "node:test";
import { actualCapabilityEntries } from "../../../../../src/sessions/runtime/capabilities/collect-entries.ts";

test("warm file function metadata retains an independently addressable module switch", () => {
  const functions = ["read", "edit", "write", "ls"].map((name) => ({ name, signature: "()", description: name, module: "files", source: "/prelude/files.py", available: true }));
  const ctx = { dependencies: {}, helpers: functions, target: { id: "fixture" }, toolInventory: [] };
  const entries = actualCapabilityEntries(ctx, []);
  const module = entries.find((entry) => entry.id === "kernel:module:files");
  assert(module);
  assert.equal(module.moduleOnly, true);
  assert.equal(module.available, true);
  assert.equal(module.source, "/prelude/files.py");
  assert.equal(entries.filter((entry) => entry.module === "files").length, functions.length + 1);
  ctx.helpers = [{ name: "module:files", signature: "", description: "Awaiting inspection", module: "files", moduleOnly: true, available: false }];
  assert.equal(actualCapabilityEntries(ctx, []).filter((entry) => entry.id === "kernel:module:files").length, 1, "Cold module metadata is never duplicated");
});
