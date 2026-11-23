import test from "node:test";
import assert from "node:assert/strict";
import { isEnvironmentSnapshot } from "../../../src/gateway/instance-environments/is-environment-snapshot.ts";

const snapshot = { target: "owned", streamId: "stream", revision: 0, status: "idle", transferredBytes: 0, totalBytes: 0, percent: 0, bytesPerSecond: 0 };

test("environment snapshots accept real progress and require structured failures", () => {
  for (const status of ["idle", "checking", "transferring", "ready"]) assert(isEnvironmentSnapshot({ ...snapshot, status }));
  assert(isEnvironmentSnapshot({ ...snapshot, status: "transferring", revision: 4, transferredBytes: 15, totalBytes: 100, percent: 15, bytesPerSecond: 123.5 }));
  assert(isEnvironmentSnapshot({ ...snapshot, status: "failed", error: { code: "TARGET_UNREACHABLE", message: "Connection lost", details: { stage: "transfer" } } }));
  for (const change of [
    { status: ["ready"] }, { status: "unknown" }, { status: "failed" }, { streamId: "" }, { target: "" },
    { revision: -1 }, { revision: 1.5 }, { transferredBytes: -1 }, { totalBytes: Number.MAX_SAFE_INTEGER + 1 },
    { percent: Infinity }, { percent: 101 }, { bytesPerSecond: NaN }, { bytesPerSecond: -1 },
    { sessionId: "not-an-environment-route" }, { error: { code: "FAIL", message: "Failure", details: [] } },
  ]) assert.equal(isEnvironmentSnapshot({ ...snapshot, ...change }), false, JSON.stringify(change));
});
