import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withSleepSettingsFixture } from "./sleepset/assemble-fixture.mjs";

await withSleepSettingsFixture(async (f) => {
  await f.stop();
  const { agentDir } = initializePrkHome(f.home);
  const directory = join(agentDir, "skills", "no-skills-reload-probe");
  await mkdir(directory, { recursive: true });
  const path = join(directory, "SKILL.md");
  await writeFile(path, "---\nname: no-skills-reload-probe\ndescription: Owned noSkills reload regression\n---\nRead this fixture.\n");
  await f.start();
  const control = await f.create("No skills control"), fallback = await f.create("No skills model fallback");
  const observations = [];
  const observe = async (label, sessionId) => {
    const catalog = await f.change(sessionId, "capabilities", {});
    const skill = catalog.entries.find((entry) => entry.id === `skill:${path}`);
    assert(skill, "Owned fixture skill remains visible in the global-backed session catalog");
    assert.equal(skill.loaded, false, "noSkills intentionally prevents loading, not discovery in the global catalog");
    const snapshot = await f.state(sessionId);
    observations.push({ label, state: snapshot.state, snapshot: snapshot.requiresReload, catalog: catalog.requiresReload });
    return snapshot;
  };
  await observe("new", control);
  await f.stop();
  await f.markUnavailable(fallback);
  await f.start();
  assert.equal((await f.state(control)).state, "sleeping");
  assert.equal((await f.state(fallback)).state, "sleeping");
  await f.request("wakeSession", { sessionId: control });
  await observe("ordinary wake", control);
  await f.request("wakeSession", { sessionId: fallback });
  const restored = await observe("model fallback wake", fallback);
  assert.equal(restored.modelFallback.previousModel, "sleepset/removed");
  assert.equal(restored.model, "sleepset/primary");
  console.log(JSON.stringify(observations, null, 2));
  for (const observation of observations) {
    assert.equal(observation.snapshot, false, `${observation.label}: noSkills must not show the resource reload banner`);
    assert.equal(observation.catalog, false, `${observation.label}: intentionally unloaded skills do not require reload`);
  }
});
console.log("PASS noSkills: new, ordinary wake and unavailable-model fallback retain unloaded catalog skills without a false reload banner");
