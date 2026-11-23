import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkRemoteRegistration({ host, client, sessionId: worker, backingCwd, targetCwd, configDir }) {
  const native = async (action, args) => {
    const result = await client.request("nativeAction", { sessionId: worker, requestId: crypto.randomUUID(), action, ...(args ? { args } : {}) });
    assert.equal(result.status, "completed", JSON.stringify(result));
    return result.data;
  };
  const before = host.state(worker);
  assert.equal((await native("capabilities")).requiresReload, false);
  const settingsPath = join(backingCwd, configDir, "settings.json");
  const settings = JSON.parse(await readFile(settingsPath, "utf8"));
  await writeFile(settingsPath, JSON.stringify({ ...settings, thinkingLevel: "high" }));
  assert.equal((await native("capabilities")).requiresReload, false, "Non-registration target settings do not require reload");
  for (const [relative, marker] of [
    [[".agents", "skills", "cwd-agents-skill", "SKILL.md"], "TARGET_SKILL_REGISTRATION_BODY_48216"],
    [[configDir, "extensions", "cwd-proof.js"], "TARGET_PLUGIN_REGISTRATION_BODY_48216"],
  ]) {
    const backingPath = join(backingCwd, ...relative);
    const gatewayPath = join(targetCwd, ...relative);
    const gatewayBody = await readFile(gatewayPath, "utf8");
    const original = await readFile(backingPath, "utf8");
    await writeFile(backingPath, `${original}\n${relative.at(-1).endsWith(".js") ? "// " : ""}${marker}\n`);
    assert.equal(host.state(worker).requiresReload, false, "Synchronous snapshots perform no target IO and retain the last observation");
    assert.equal((await client.request("nativeCapabilities", { sessionId: worker })).target.current.requiresReload, false, "Native capability discovery remains synchronous and does not probe remote files");
    const catalog = await native("capabilities");
    assert.equal(catalog.requiresReload, true, `An explicit capability query observes the changed target file: ${gatewayPath}`);
    assert.equal(host.state(worker).requiresReload, true, "Subsequent synchronous snapshots reuse the observed registration change");
    assert(!JSON.stringify(catalog).includes(marker), "Remote registration queries never return skill/plugin bodies");
    assert.equal(await readFile(gatewayPath, "utf8"), gatewayBody, "The Gateway's same absolute resource path is untouched");
    await native("reload");
    assert.equal((await native("capabilities")).requiresReload, false, "Reload captures the current target registration versions");
    assert.equal(host.state(worker).sessionId, before.sessionId);
    assert.equal(host.state(worker).kernel.kernelId, before.kernel.kernelId, "Resource reload preserves the original kernel");
  }
}
