import assert from "node:assert/strict";

// Existing capability controls retain the global -> instance -> session precedence for a session-host plugin's tools.
// The group is keyed by the plugin's `source`, its one identity in the plugin list (docs/wire/plugin-config.md).
export async function checkRemoteCapabilityLayers({ page, host, packageSource, until, name, native, openSettings, openInstance }) {
  const groupId = `group:tools:remote:fixture:${packageSource}`;
  const live = ".capability-detail-host > .pi-fade-live";
  const loadedTools = () => page.locator('.capabilities-panel[data-kind="tools"][aria-busy="false"]').waitFor();
  const showRemote = async () => {
    await loadedTools();
    await page.locator('[data-category="remote:fixture"]').waitFor();
    await page.locator(`#tools-sources [data-provider="${groupId}"] .capability-provider-name`).click();
    await page.waitForFunction(() => !document.querySelector(".pi-fade-leaving"));
    await page.locator(`${live} [data-capability="tool:remote_ui"]`).waitFor();
  };
  const remoteTool = () => page.locator(`${live} [data-capability="tool:remote_ui"]`);
  const stopRemote = (stop) => remoteTool().locator(`[data-stop="${stop}"]`);
  const isRemoteOn = async () => (await remoteTool().locator(".capability-mode").getAttribute("data-mode")) !== "off";
  await openSettings("tools");
  await showRemote();
  await stopRemote("off").click();
  await until(() => host.capabilitiesList(), (value) => value.defaults.capabilities["tool:remote_ui"] === false, "global remote switch saved");
  await page.locator("#close-settings").click();
  await openInstance("tools");
  await showRemote();
  assert.equal(await isRemoteOn(), false);
  await stopRemote("on").click();
  await until(() => host.capabilitiesList("fixture"), (value) => value.catalog.entries.find((entry) => entry.id === "tool:remote_ui")?.configured === true, "instance remote override saved");
  await remoteTool().locator('[data-overridden="true"]').waitFor();
  await page.locator("#close-instance-settings").click();
  await page.locator(`[data-session-id="${name}"] [data-action="session-menu"]`).click();
  await page.locator("#session-tools").click();
  await showRemote();
  assert.equal(await isRemoteOn(), true);
  await stopRemote("off").click();
  await remoteTool().locator('[data-overridden="true"]').waitFor();
  assert.equal((await native("capabilities", {})).body.data.entries.find((entry) => entry.id === "tool:remote_ui").configured, false);
  await remoteTool().locator('[data-action="restore-default"]').click();
  await until(async () => (await native("capabilities", {})).body.data, (value) => value.entries.find((entry) => entry.id === "tool:remote_ui")?.configured === true, "session reset rejoins instance override");
  await loadedTools();
  assert.equal(await isRemoteOn(), true, "session reset rejoins the instance's enabled remote tool");
  await page.locator("#close-session-capabilities").click();
  await openInstance("tools");
  await showRemote();
  await remoteTool().locator('[data-action="restore-default"]').click();
  await until(() => host.capabilitiesList("fixture"), (value) => value.catalog.entries.find((entry) => entry.id === "tool:remote_ui")?.configured === false, "instance reset rejoins global default");
  await page.locator("#close-instance-settings").click();
  await openSettings("tools");
  await showRemote();
  assert.equal(await isRemoteOn(), false);
  await stopRemote("on").click();
  await until(() => host.capabilitiesList(), (value) => value.defaults.capabilities["tool:remote_ui"] === true, "global remote switch restored");
  await page.locator("#close-settings").click();
  const managedReload = await native("reload", {});
  assert.equal(managedReload.body.status, "completed", JSON.stringify(managedReload));
  assert.equal(host.state(name).requiresReload, false);
}
