import assert from "node:assert/strict";
import { test } from "node:test";
import { describeCommandError } from "../../../../src/application/command-line/describe-command-error.ts";
import { notify } from "../../../../src/sessions/global-catalog/notify.ts";
import { rejectFailures } from "../../../../src/sessions/global-catalog/reject-discovery-errors.ts";

test("an unattributed error still rejects discovery and reaches the startup diagnostic", () => {
  const ctx = { failures: [] };
  notify(ctx, "Something failed without source metadata", "error");
  assert.throws(() => rejectFailures(ctx), (error) =>
    describeCommandError(error).includes("Unattributed plugin notification: Something failed without source metadata"));
});
