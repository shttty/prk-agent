import assert from "node:assert/strict";
import { test } from "node:test";
import { notify } from "../../../../src/sessions/global-catalog/notify.ts";
import { rejectFailures } from "../../../../src/sessions/global-catalog/reject-discovery-errors.ts";

test("a warning is recorded under its package source without rejecting discovery", () => {
  const pluginWarnings = new Map();
  const ctx = { input: { pluginWarnings }, failures: [] };
  notify(ctx, "Startup warning from fixture A", "warning", "npm:fixture-a");
  rejectFailures(ctx);
  assert.deepEqual([...pluginWarnings.get("npm:fixture-a")], ["Startup warning from fixture A"]);
});
