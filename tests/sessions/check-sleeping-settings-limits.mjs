import assert from "node:assert/strict";
import { DEFAULT_LIMITS_OPTIONS } from "../../src/config/limits/limits-options.ts";
import { withSleepSettingsFixture } from "./sleepset/assemble-fixture.mjs";

const scopedModelsMax = DEFAULT_LIMITS_OPTIONS.scopedModelsMax + 1;
await withSleepSettingsFixture(async (f) => {
  const sessionId = await f.create("Configured sleeping scope limit");
  await f.stop();
  await f.start();
  const models = Array.from({ length: scopedModelsMax }, () => "sleepset/primary");
  await f.change(sessionId, "scoped-models", { models });
  await f.change(sessionId, "thinking", { level: "high" });
  assert.equal((await f.state(sessionId)).state, "sleeping");
  assert.deepEqual((await f.state(sessionId)).scopedModels, models);
  const offset = f.provider.requests.length;
  await f.send(sessionId, "CONFIGURED_SCOPE_LIMIT");
  assert.equal(f.provider.requests[offset].reasoning.effort, "high");
  assert.deepEqual((await f.request("nativeCapabilities", { sessionId })).target.current.scopedModels, models);
}, { scopedModelsMax });
console.log("PASS configured scope limit: sleeping writes and wake use the same configured bound");
