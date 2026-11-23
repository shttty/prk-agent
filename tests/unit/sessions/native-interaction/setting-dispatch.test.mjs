import assert from "node:assert/strict";
import test from "node:test";
import { nativeAction } from "../../../../src/gateway/native-interactions/dispatch/execute-native-action.ts";


test("light settings resolve their target only after admission, without enumerating the catalog", async () => {
  let admitted = false;
  let targetReads = 0;
  const target = {};
  const ctx = {
    methods: {
      nativeTarget: () => { assert.equal(admitted, true); targetReads++; return target; },
      changeSessionRuntime: (name, run) => { assert.equal(name, "fixture"); admitted = true; return run(); },
    },
    sessionHosts: { hostBindings: new Map() },
    native: { nativeInteractions: {
      catalog: () => assert.fail("setting dispatch must not build a catalog"),
      action: (actual, request) => { assert.equal(actual, target); return { status: "completed", action: request.action }; },
    } },
  };
  for (const action of ["thinking", "tool-mode", "model", "delegation"]) {
    admitted = false;
    await nativeAction(ctx, "fixture", { action });
  }
  assert.equal(targetReads, 4);
});
