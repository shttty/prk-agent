import assert from "node:assert/strict";
import { test } from "node:test";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { createSessionSettings } from "../../../../src/sessions/session-settings/create-settings.ts";
import { notify } from "../../../../src/sessions/global-catalog/notify.ts";
import { rejectFailures } from "../../../../src/sessions/global-catalog/reject-discovery-errors.ts";

test("an attributed error removes only its package from new SDK sessions", () => {
  const ctx = { pluginFailures: new Map(), failures: [] };
  const broken = { source: "npm:fixture-b", enabled: true, location: "gateway" };
  const healthy = { source: "npm:fixture-healthy", enabled: true, location: "gateway" };
  const source = SettingsManager.inMemory({ packages: [broken, healthy] });
  notify(ctx, "fixture B could not start", "error", broken.source);
  rejectFailures(ctx);
  const settings = createSessionSettings("/fixture", "/fixture/agent", undefined, source, ctx.pluginFailures);
  assert.equal(ctx.pluginFailures.get(broken.source), "fixture B could not start");
  assert.deepEqual(settings.getPackages(), [{ source: "npm:fixture-healthy" }]);
});
