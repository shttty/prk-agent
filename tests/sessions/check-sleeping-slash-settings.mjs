import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withSleepSettingsFixture } from "./sleepset/assemble-fixture.mjs";

await withSleepSettingsFixture(async (f) => {
  const sessionId = await f.create("Sleeping slash settings");
  await f.stop();
  await f.start();
  const calls = f.provider.requests.length, kernels = await f.kernels();
  for (const message of ["/model sleepset/alternate", "/thinking high", "/scoped-models sleepset/alternate"]) {
    const result = await f.request("send", { sessionId, requestId: randomUUID(), message, mode: "auto" });
    assert.equal(result.status, "completed", JSON.stringify(result));
    assert.equal((await f.state(sessionId)).state, "sleeping", `${message} must use history admission without waking`);
  }
  for (const message of ["/compact", "/reload", "/export jsonl"]) {
    const result = await f.request("send", { sessionId, requestId: randomUUID(), message, mode: "auto" });
    assert.equal(result.status, "unavailable", JSON.stringify(result));
    assert.equal(result.data.executed, false);
    assert.equal((await f.state(sessionId)).state, "sleeping");
  }
  assert.equal(f.provider.requests.length, calls);
  assert.deepEqual(await f.kernels(), kernels);
  await f.send(sessionId, "SLASH_SETTINGS_FIRST_REQUEST");
  const payload = f.provider.requests[calls];
  assert.equal(payload.model, "alternate");
  assert.equal(payload.reasoning.effort, "high");
  const current = (await f.request("nativeCapabilities", { sessionId })).target.current;
  assert.deepEqual(current.scopedModels, ["sleepset/alternate"]);
});
console.log("PASS sleeping slash settings: same serialized history admission, no runtime-only implicit wake, first real provider payload");
