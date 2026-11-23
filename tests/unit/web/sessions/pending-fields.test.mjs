// Optional fields the frontend already reads and the backend does not send yet (docs/wire/sessions.md, native.md):
// present → shown, absent → nothing at all.
import assert from "node:assert/strict";
import test from "node:test";
import { delegationLevel } from "../../../../web/sessions/details/delegation-level.js";
import { runTime } from "../../../../web/sessions/children/run-time.js";

test("delegation is shown only for a known level from the snapshot", () => {
  assert.equal(delegationLevel({ delegation: "eager" }), "eager");
  assert.equal(delegationLevel({}), null);
  assert.equal(delegationLevel({ delegation: "turbo" }), null, "an unknown value is not shown");
  assert.equal(delegationLevel(undefined), null);
});

test("run time needs startedAt; a delivered child shows total time only with finishedAt", () => {
  const now = 1_000_000;
  assert.equal(runTime({ startedAt: now - 65_000 }, now), "已运行 1m 5s");
  assert.equal(runTime({ startedAt: now - 600_000, finishedAt: now - 60_000, delivered: true }, now), "用时 9m 0s");
  assert.equal(runTime({ startedAt: now - 600_000, delivered: true }, now), "", "no end time: no total");
  assert.equal(runTime({}, now), "");
  assert.equal(runTime({ startedAt: "yesterday" }, now), "");
});
