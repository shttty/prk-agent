import assert from "node:assert/strict";
import { withSleepSettingsFixture } from "./assemble-fixture.mjs";

export async function checkTransitionRaces() {
  await withSleepSettingsFixture(async (f) => {
    const sessionId = await f.create("Sleep/wake settings writer ownership");
    await f.until(() => f.host.state(sessionId).state === "sleeping", "real idle reclamation releases its runtime");
    const before = await f.entries(sessionId), offset = f.provider.requests.length;
    const wake = f.request("wakeSession", { sessionId });
    const settings = [
      ["model", { model: "sleepset/alternate" }], ["thinking", { level: "high" }],
      ["tool-mode", { mode: "direct" }], ["delegation", { level: "restrained" }],
      ["local-tools", { enabled: true }], ["capabilities", { changes: [{ id: "tool:ask", enabled: false }] }],
      ["scoped-models", { models: ["sleepset/alternate"] }],
    ];
    await Promise.all([wake, ...settings.map(([name, args]) => f.change(sessionId, name, args))]);
    assert.equal(f.provider.requests.length, offset, "Concurrent wake and settings never admit a model request");
    const entries = await f.entries(sessionId);
    const added = entries.slice(before.length);
    assert(added.some((entry) => entry.type === "model_change" && entry.modelId === "alternate"));
    assert(added.some((entry) => entry.type === "thinking_level_change" && entry.thinkingLevel === "high"));
    const chain = entries.filter(({ type }) => type !== "session");
    assert.equal(new Set(chain.map(({ id }) => id)).size, chain.length, "Concurrent transitions retain unique SDK entry identities");
    assert.equal(chain[0].parentId, null);
    for (let index = 1; index < chain.length; index++) {
      assert.equal(chain[index].parentId, chain[index - 1].id, "Single-writer settings append one continuous native leaf chain");
    }
    await f.until(() => f.host.state(sessionId).state === "sleeping", "runtime is naturally reclaimed after concurrent edits");
    const sleeping = await f.state(sessionId);
    assert.equal(sleeping.model, "sleepset/alternate");
    assert.equal(sleeping.thinkingLevel, "high");
    assert.equal(sleeping.toolMode, "direct");
    assert.equal(sleeping.delegation, "restrained");
    await f.send(sessionId, "SLEEPSET_TRANSITION_REQUEST");
    const payload = f.provider.requests[offset];
    assert.equal(payload.model, "alternate");
    assert.equal(payload.reasoning?.effort, "high");
    assert(payload.tools.some(({ name }) => name === "read"));
    assert(!payload.tools.some(({ name }) => name === "ask"));
    const current = (await f.request("nativeCapabilities", { sessionId })).target.current;
    assert.deepEqual(current.scopedModels, ["sleepset/alternate"]);
    assert.equal(current.localTools, true);
    await f.evidence("sleeping-transition-race.json", { settings, entries: added, payload });
  }, { idleTimeoutMs: 800 });
}
