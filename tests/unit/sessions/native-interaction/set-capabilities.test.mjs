import assert from "node:assert/strict";
import { test } from "node:test";
import { setCapabilities } from "../../../../src/sessions/native-interaction/settings/set-capabilities.ts";

const request = (args) => ({ sessionId: "fixture", requestId: "request", action: "capabilities", ...(args ? { args } : {}) });

test("explicit capability queries await registration refresh before reading the catalog", async () => {
  const calls = [];
  const target = {
    streamId: "stream", refreshRegistration: async () => { await Promise.resolve(); calls.push("refresh"); },
    capabilityCatalog: () => { calls.push("catalog"); return { requiresReload: true }; },
  };
  const result = await setCapabilities({}, target, request());
  assert.equal(result.status, "completed");
  assert.deepEqual(calls, ["refresh", "catalog"]);
  assert.equal(result.data.requiresReload, true);
});

test("permission mutations never require target registration IO", async () => {
  const changed = [];
  let refreshes = 0;
  const target = {
    streamId: "stream", readOnly: false, state: "idle", session: {},
    refreshRegistration: async () => { refreshes++; throw new Error("Target unavailable"); },
    capabilityCatalog: () => ({ requiresReload: false }),
    setCapabilities: (changes) => changed.push(...changes),
  };
  const result = await setCapabilities({}, target, request({ changes: [{ id: "tool:probe", enabled: false }] }));
  assert.equal(result.status, "completed");
  assert.deepEqual(changed, [{ id: "tool:probe", enabled: false }]);
  assert.equal(refreshes, 0, "Closing a tool remains available even when target stat would fail");
});
