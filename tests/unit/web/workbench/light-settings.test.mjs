import assert from "node:assert/strict";
import test from "node:test";
import { updateLightSetting } from "../../../../web/workbench/store/native-actions/update-light-setting.js";

test("light settings and their rollback touch only the session snapshot, the one source of these fields", () => {
  const row = { sessionId: "fixture", state: "idle" };
  const catalog = { value: { target: { current: { localTools: false } } }, loading: false };
  const ctx = { listeners: new Set(), state: {
    selectedSessionId: "fixture", sessions: new Map([["fixture", row]]),
    session: { snapshot: { thinkingLevel: "off", toolMode: "code", messages: [] }, nativeCatalog: catalog },
  } };
  const rollback = updateLightSetting(ctx, { thinkingLevel: "high" });
  updateLightSetting(ctx, { toolMode: "direct" });
  ctx.state.session.snapshot.messages = ["new live message"];
  assert.equal(ctx.state.session.snapshot.thinkingLevel, "high");
  rollback();
  assert.equal(ctx.state.session.snapshot.thinkingLevel, "off");
  assert.equal(ctx.state.session.snapshot.toolMode, "direct", "rolling back one field keeps the other setting");
  assert.deepEqual(ctx.state.session.snapshot.messages, ["new live message"], "rollback keeps later live data");
  assert.equal(ctx.state.sessions.get("fixture"), row, "the workbench row is not a second copy");
  assert.equal(ctx.state.session.nativeCatalog, catalog, "the native catalog is not a third copy");
});

test("sleeping light settings retain server values until a pushed snapshot arrives", () => {
  const snapshot = { state: "sleeping", model: "provider/original", thinkingLevel: "low", toolMode: "code", delegation: "gated" };
  const ctx = { listeners: new Set(), state: { session: { snapshot } } };
  assert.equal(updateLightSetting(ctx, { model: "provider/new", thinkingLevel: "high", toolMode: "direct", delegation: "eager" }), null);
  assert.equal(ctx.state.session.snapshot, snapshot);
  assert.deepEqual(ctx.state.session.snapshot, { state: "sleeping", model: "provider/original", thinkingLevel: "low", toolMode: "code", delegation: "gated" });
});
