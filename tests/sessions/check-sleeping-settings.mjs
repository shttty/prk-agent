import assert from "node:assert/strict";
import { withSleepSettingsFixture } from "./sleepset/assemble-fixture.mjs";
import { checkSleepingSettings } from "./sleepset/check-settings.mjs";
import { checkSleepingPayload } from "./sleepset/check-first-payload.mjs";
import { checkTransitionRaces } from "./sleepset/check-transition-races.mjs";

await withSleepSettingsFixture(async (fixture) => {
  const sleeping = await fixture.create("Sleeping settings subject");
  const awake = await fixture.create("Awake settings shape oracle");
  await fixture.stop();
  await fixture.start();
  await fixture.request("wakeSession", { sessionId: awake });
  assert.equal((await fixture.state(sleeping)).state, "sleeping");
  const shapes = await checkSleepingSettings(fixture, { sleeping, awake });
  const payloads = await checkSleepingPayload(fixture, sleeping);
  await fixture.evidence("sleeping-settings.json", { sleeping, awake, shapes, payloads });
});
await checkTransitionRaces();
console.log("PASS sleeping settings: real Gateway/SDK/Jupyter, identical native entries, shared rejection, no wake, restart restore, first HTTP model/reasoning/tool declarations");
