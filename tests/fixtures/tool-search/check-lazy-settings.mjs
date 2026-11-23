import { parse } from "smol-toml";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkLazySettings(fixture) {
  const { home, client, catalog, toggle, run, host, sessionId: worker } = fixture;
  const initial = host.state(worker);
  const inventory = await catalog();
  const group = inventory.groups.find((item) => item.id === inventory.entries.find((entry) => entry.name === "search_default").group);
  assert(group.lazy.available, "Callable plugin groups expose their own applicable lazy setting");
  const toolId = "lazy:tool:search_default";
  const groupId = group.lazy.id;
  const change = (id, enabled, instance) => client.request("capabilitiesChange", { changes: [{ id, enabled }], ...(instance ? { instance } : {}) });
  // Pin unrelated plugin declarations so group transitions isolate search_default.
  await toggle("lazy:tool:search_lazy", true);
  await toggle("lazy:tool:search_description", true);
  await toggle("lazy:tool:search_resident", false);
  const baseline = (await run()).requests[0].tools;
  const observe = async (lazy, label) => {
    const current = await catalog();
    const entry = current.entries.find((item) => item.name === "search_default");
    assert.equal(entry.enabled, true, "Lazy loading never disables the target tool");
    assert.equal(entry.lazy.enabled, lazy, `${label}: catalog effective lazy`);
    assert.equal(current.requiresReload, false, `${label}: lazy changes need no reload`);
    const request = (await run()).requests[0];
    const expected = lazy ? baseline.filter((name) => name !== "search_default") : baseline;
    assert.deepEqual(request.tools, expected, `${label}: very next provider request applies the setting`);
    const state = host.state(worker);
    assert.equal(state.streamId, initial.streamId, `${label}: same SDK runtime`);
    assert.equal(state.sessionId, initial.sessionId);
    assert.equal(state.kernel.kernelId, initial.kernel.kernelId);
  };
  await change(toolId, true);
  await observe(true, "global tool override");
  await change(groupId, false);
  await observe(true, "same global layer tool beats group");
  await change(groupId, false, "fixture");
  await observe(false, "instance group beats lower global tool");
  await change(toolId, true, "fixture");
  await observe(true, "same instance layer tool beats group");
  const savedInstance = structuredClone(parse(await readFile(join(home, "instances.toml"), "utf8"))).instances[0];
  assert.equal(savedInstance.capabilities[toolId], true, "Instance tool lazy persists in instances.toml");
  assert.equal(savedInstance.capabilities[groupId], false, "Instance group lazy persists separately from the global tool value");
  await toggle(groupId, false);
  await observe(false, "session group beats lower instance tool");
  await toggle(toolId, true);
  await observe(true, "same session layer tool beats group");
  assert.equal((await catalog()).entries.find((entry) => entry.name === "search_default").lazy.overridden, true);
  await change(toolId, false);
  await change(groupId, true);
  await change(toolId, false, "fixture");
  await change(groupId, true, "fixture");
  await observe(true, "explicit session tool survives both lower layer changes");
  await toggle(toolId, null);
  await observe(false, "reset tool exposes same-layer session group");
  await toggle(groupId, null);
  await observe(false, "reset session group exposes instance tool over instance group");
  assert.equal((await catalog()).entries.find((entry) => entry.name === "search_default").lazy.overridden, false);
  await change(toolId, null, "fixture");
  await observe(true, "reset instance tool exposes instance group");
  await change(groupId, null, "fixture");
  await observe(false, "reset instance group exposes global tool over global group");
  await change(toolId, true);
  await observe(true, "untouched session rejoins global inheritance");
  await change(toolId, false);
  await change(groupId, false);
  await observe(false, "restored plugin resident defaults");
  const persisted = structuredClone(parse(await readFile(join(home, "config.toml"), "utf8")));
  assert.equal(persisted.session.capabilities[toolId], false, "Global lazy settings persist in their independent namespace");
  assert.equal(persisted.session.capabilities["tool:search_default"], undefined, "Lazy loading never writes the enable namespace");
  const instances = structuredClone(parse(await readFile(join(home, "instances.toml"), "utf8")));
  assert.equal(instances.instances[0].capabilities[toolId], undefined, "Instance reset removes only its persisted override");
  assert.equal(instances.instances[0].capabilities[groupId], undefined);
  for (const id of ["delay:tool:search_default", `delay:${group.id}`, "lazy:tool:search_model_only", "lazy:tool:search_disabled", "lazy:tool:tool_search", "lazy:tool:tool_call", "lazy:tool:read"]) {
    for (const enabled of [true, false]) {
      await assert.rejects(async () => change(id, enabled), undefined, `${id} is unavailable through the global API`);
    }
    for (const enabled of [true, false, null]) {
      await assert.rejects(async () => change(id, enabled, "fixture"), undefined, `${id} cannot change or reset its unavailable instance lazy`);
      const reply = await client.request("nativeAction", { sessionId: worker, requestId: crypto.randomUUID(), action: "capabilities", args: { changes: [{ id, enabled }] } });
      assert.equal(reply.status, "failed", `${id} cannot change or reset its unavailable session lazy`);
    }
  }
}
