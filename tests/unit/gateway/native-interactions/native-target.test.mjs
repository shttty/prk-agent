import assert from "node:assert/strict";
import test from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { nativeTarget } from "../../../../src/gateway/native-interactions/dispatch/resolve-native-target.ts";

test("native target takes stream identity and state from host scalars, never from a built snapshot", () => {
  const entry = { sessionId: "s1", target: "t", sleeping: false, manager: SessionManager.inMemory("/tmp") };
  const host = { streamId: "live-stream", state: "running", getSnapshot: () => assert.fail("a native target must not clone the session snapshot") };
  const runtime = { toolMode: "code", delegation: "gated", localTools: false, requiresReload: false, session: {} };
  const ctx = {
    methods: {
      storedSession: () => entry,
      sessionHost: () => host,
      archivedSnapshot: () => assert.fail("a native target must not project retained history"),
      archivedStream: () => ({ streamId: "retained-stream", state: "sleeping" }),
    },
    host: { collection: { get: () => runtime }, config: { session: { workerTools: "code", delegation: "gated" } } },
    instances: { targets: [] },
    models: {},
    capabilities: { capabilityDefaults: { localTools: false } },
  };
  const live = nativeTarget(ctx, "s1");
  assert.deepEqual([live.streamId, live.state, live.readOnly], ["live-stream", "running", false]);
  entry.sleeping = true;
  const sleeping = nativeTarget(ctx, "s1");
  assert.deepEqual([sleeping.streamId, sleeping.state, sleeping.readOnly], ["retained-stream", "sleeping", false]);
});
