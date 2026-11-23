import { parse } from "smol-toml";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function verifyInstanceSettings({ web, targetHome, globalHome, catalog, action, winner, home, cwd }) {
  const settings = async (instance, change) => {
    const response = await fetch(`${web.url}/api/capabilities${change ? "" : `?instance=${encodeURIComponent(instance)}`}`, change ? {
      method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify({ instance, changes: [change] }),
    } : undefined);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const homeSkill = `skill:${globalHome}/gateway-only/SKILL.md`;
  const instanceView = await settings("fixture");
  assert(!instanceView.catalog.groups.some((group) => group.id === "group:skills:instance"));
  assert(!instanceView.catalog.groups.some((group) => group.id.startsWith("group:skills:dir:fixture:")), "Instance settings have no session cwd and must not discover target project directories");
  assert.equal(instanceView.instanceError, undefined);
  const askEntry = instanceView.catalog.entries.find((entry) => entry.id === "tool:ask");
  assert.equal(askEntry.configured, true);
  assert.equal(askEntry.defaultEnabled, false);
  assert.equal(askEntry.overridden, true);
  const addHomeSkill = async (name) => {
    await mkdir(join(targetHome, name));
    await writeFile(join(targetHome, name, "SKILL.md"), `---\nname: ${name}\ndescription: Excluded target home fixture ${name}\n---\n${name}\n`);
    return `skill:${targetHome}/${name}/SKILL.md`;
  };
  const refresh = (body) => fetch(`${web.url}/api/capabilities/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify(body),
  });
  const manualSkill = await addHomeSkill("manual-refresh");
  assert(!(await settings("fixture")).catalog.entries.some((entry) => entry.id === manualSkill), "Instance GET does not expose target home");
  const refreshed = await refresh({ instance: "fixture" });
  assert.equal(refreshed.status, 200, await refreshed.clone().text());
  assert(!(await refreshed.json()).catalog.entries.some((entry) => entry.id === manualSkill), "Manual instance refresh must not restore target-home skills");
  const sessionSkill = await addHomeSkill("session-discovery");
  assert(!(await settings("fixture")).catalog.entries.some((entry) => entry.id === sessionSkill));
  await action("reload");
  const sessionView = await settings("fixture");
  assert(!sessionView.catalog.entries.some((entry) => entry.id === sessionSkill), "Session reload must not publish target-home skills into instance settings");
  assert(!sessionView.catalog.entries.some((entry) => entry.id === winner), "Reused session discovery excludes project skills");
  for (const body of [{ instance: "fixture", extra: true }, { extra: true }, { instance: "" }, { instance: 1 }, { instance: null }]) {
    assert.equal((await refresh(body)).status, 400, JSON.stringify(body));
  }
  await settings("fixture", { id: "tool:ask", enabled: null });
  assert.equal((await catalog()).entries.find((entry) => entry.id === "tool:ask").defaultEnabled, false, "Deleting an instance override restores the global default");
  for (const query of ["instance=", "instance=fixture&instance=fixture", "instance=fixture&other=1"]) {
    assert.equal((await fetch(`${web.url}/api/capabilities?${query}`)).status, 400);
  }
  for (const change of [{ instance: "fixture", changes: [{ id: homeSkill, enabled: "false" }] }, { id: "tool:ask", enabled: null }, { instance: "fixture", changes: [{ id: "tool:ask", enabled: false }], extra: true }]) {
    const invalid = await fetch(`${web.url}/api/capabilities`, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify(change) });
    assert.equal(invalid.status, 400);
  }
  const missingView = await settings("missing-instance");
  assert.equal(typeof missingView.instanceError, "string");
  assert(missingView.catalog.entries.some((entry) => entry.id === `skill:${globalHome}/x/SKILL.md`), "Unavailable instance preserves the Gateway catalog");
  const changedDefaults = await settings("fixture", { id: homeSkill, enabled: false });
  const instanceEntry = changedDefaults.catalog.entries.find((entry) => entry.id === homeSkill);
  assert.equal(instanceEntry.configured, false);
  assert.equal(instanceEntry.defaultEnabled, true);
  assert.equal(instanceEntry.overridden, true);
  let sessionEntry = (await catalog()).entries.find((entry) => entry.id === homeSkill);
  assert.equal(sessionEntry.defaultEnabled, false);
  assert.equal(sessionEntry.configured, false);
  assert.equal(sessionEntry.overridden, false);
  assert.equal((await catalog()).requiresReload, false, "Instance skill switches apply without registration changes");
  assert.equal((await catalog()).entries.find((entry) => entry.id === homeSkill).loaded, true, "Disabled skills stay registered");
  assert.equal((await catalog()).entries.find((entry) => entry.id === homeSkill).enabled, false);
  await action("capabilities", { changes: [{ id: homeSkill, enabled: true }] });
  sessionEntry = (await catalog()).entries.find((entry) => entry.id === homeSkill);
  assert.equal(sessionEntry.configured, true);
  assert.equal(sessionEntry.defaultEnabled, false);
  assert.equal((await catalog()).requiresReload, false);
  assert.equal((await catalog()).entries.find((entry) => entry.id === homeSkill).loaded, true);
  assert.equal((await catalog()).entries.find((entry) => entry.id === homeSkill).enabled, true);
  await action("capabilities", { changes: [{ id: homeSkill, enabled: null }] });
  assert.equal((await catalog()).entries.find((entry) => entry.id === homeSkill).configured, false);
  await settings("fixture", { id: homeSkill, enabled: null });
  const saved = structuredClone(parse(await readFile(join(home, "config.toml"), "utf8")));
  const savedInstances = structuredClone(parse(await readFile(join(home, "instances.toml"), "utf8")));
  assert.equal(savedInstances.instances[0].capabilities[homeSkill], undefined);
  assert.equal(savedInstances.instances[0].cwd, cwd);
  assert.equal(saved.memory.review, false);
  return { settings, addHomeSkill };
}
