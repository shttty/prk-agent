import assert from "node:assert/strict";
import test from "node:test";
import { resolveSessionSettingsFlags, resolveSettingValues } from "../../../../web/sessions/details/session-settings-state.js";

test("SessionSettings distinguishes live running vs sleeping vs idle states", () => {
  assert.deepEqual(resolveSessionSettingsFlags({ connection: "connected", hostState: "idle", nativePending: false }), { live: true, idle: true });
  assert.deepEqual(resolveSessionSettingsFlags({ connection: "connected", hostState: "running", nativePending: false }), { live: true, idle: false });
  assert.deepEqual(resolveSessionSettingsFlags({ connection: "connected", hostState: "sleeping", nativePending: false }), { live: true, idle: false });
  assert.deepEqual(resolveSessionSettingsFlags({ connection: "connected", hostState: "idle", nativePending: true }), { live: false, idle: false });
  assert.deepEqual(resolveSessionSettingsFlags({ connection: "disconnected", hostState: "idle", nativePending: false }), { live: false, idle: false });
});

test("SessionSettings falls back to catalogCurrent when running and isolates loaded values per streamKey", () => {
  const catalogCurrent = { autoCompaction: true, autoRetry: false };
  assert.deepEqual(resolveSettingValues(null, "s1:a", catalogCurrent), { autoCompaction: true, autoRetry: false });

  const staleLoaded = { key: "s1:a", data: { autoCompaction: false, autoRetry: true } };
  assert.deepEqual(resolveSettingValues(staleLoaded, "s1:a", catalogCurrent), { autoCompaction: false, autoRetry: true });
  assert.deepEqual(
    resolveSettingValues(staleLoaded, "s2:b", { autoCompaction: true, autoRetry: true }),
    { autoCompaction: true, autoRetry: true },
    "stale values from another stream must not leak into the newly selected session",
  );
  assert.equal(resolveSettingValues(staleLoaded, "s2:b", undefined), null);
});
