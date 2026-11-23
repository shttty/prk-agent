import assert from "node:assert/strict";
import { test } from "node:test";
import { printable } from "../../../../web/workbench/payloads/printable.js";

test("unknown structured output preserves credential-looking keys and values", () => {
  const value = {
    token: "user-printed-token",
    password: "user-printed-password",
    nested: { secret: "user-printed-secret" },
    rows: [{ authorization: "user-printed-authorization", api_key: "user-printed-api-key" }],
  };
  assert.deepEqual(JSON.parse(printable(value)), value);
});
