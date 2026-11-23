import assert from "node:assert/strict";
import { join } from "node:path";
import { writePluginDirectory } from "../remote-extension-ui/write-plugin-directory.mjs";
import { clickPluginSwitch } from "../remote-extension-ui/click-plugin-switch.mjs";

// P4 on the real bootstrap: provider-owner enable/disable/uninstall saves at once and answers restartRequired:true;
// the notice offers the 通用 restart flow (disabled here: no gateway.systemdUnit), models keep the running bootstrap
// until the test restarts its own Gateway. Plain plugin CRUD never asks for a restart nor changes the model list.
export async function checkProviderRestart({ page, post, api, models, row, manager, openSettings, restartGateway, evidence, owner, providerId, root }) {
  const owned = `${providerId}/owned`;
  const notice = () => page.locator("#plugin-restart-notice");
  const required = async (response, expected) => {
    assert.equal(response.status(), 200, `${response.url()}: ${await response.text()}`);
    assert.equal((await response.json()).restartRequired, expected);
    assert.equal((await api("/plugins")).restartRequired, expected);
    if (!expected) return assert.equal(await notice().count(), 0);
    await notice().waitFor({ state: "visible" });
    assert.equal(await notice().getAttribute("data-status"), "unconfigured");
    assert.equal(await notice().locator('[data-action="gateway-restart"]').isDisabled(), true);
  };
  // Ordinary click on the row's visible switch track; the saved answer must flip the rendered switch too.
  const toggle = async (source) => {
    const pluginRow = () => manager().locator(`[data-plugin-source="${source}"]`);
    let before;
    const response = await post("/api/plugins/change", async () => { before = await clickPluginSwitch(pluginRow()); });
    assert.deepEqual(response.request().postDataJSON(), { source, enabled: !before });
    if (response.ok()) assert.equal(await pluginRow().getByRole("switch").isChecked(), !before);
    return response;
  };
  const uninstall = async (source) => {
    await manager().locator(`[data-plugin-source="${source}"] [data-action="plugin-uninstall"]`).click();
    const response = await post("/api/plugins/uninstall", () => page.locator("#plugin-confirm-uninstall").click());
    // The closing dialog's overlay would take the next forced click.
    await page.locator("#plugin-confirm-uninstall").waitFor({ state: "detached" });
    return response;
  };

  // Plain plugin CRUD: no restart, and the shared model list is untouched. (This home has no instance, so the backend
  // refuses the host location; location effects are covered by the remote-extension-ui suite.)
  const before = (await models()).sort();
  const plain = await writePluginDirectory(join(root, "plain-plugin"), { name: "@prk-tests/plugin-ui-plain", source: 'export default (pi) => { pi.registerCommand("plugin_ui_plain", { handler: async () => {} }); };\n' });
  await page.locator("#plugin-source").fill(plain);
  await required(await post("/api/plugins/install", () => page.locator("#plugin-install").click()), false);
  await required(await toggle(plain), false);
  await required(await uninstall(plain), false);
  assert.deepEqual((await models()).sort(), before);

  // Disabling the owner: saved, restart asked, the running bootstrap keeps the provider until the Gateway restarts.
  await required(await toggle(owner), true);
  assert.equal(await row().getAttribute("data-enabled"), "false");
  assert.ok((await models()).includes(owned), "models keep the actual bootstrap before restart");
  await page.screenshot({ path: join(evidence, "plugin-restart-desktop.png"), fullPage: true, animations: "disabled" });
  await restartGateway();
  assert.equal((await api("/plugins")).restartRequired, false);
  assert.equal(await notice().count(), 0);
  assert.equal((await models()).includes(owned), false, "the restarted Gateway reads the saved list");

  await required(await toggle(owner), true);
  assert.equal((await models()).includes(owned), false);
  await restartGateway();
  assert.ok((await models()).includes(owned));
  assert.equal(await notice().count(), 0);

  // Uninstalling the last provider owner empties the list and still asks for the restart.
  await required(await uninstall(owner), true);
  assert.deepEqual((await api("/plugins")).packages, []);
  await page.locator("#plugins-empty").waitFor({ state: "visible" });
  assert.ok((await models()).includes(owned));
  await page.screenshot({ path: join(evidence, "plugin-restart-empty-desktop.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-settings-section="plugins"]').click();
  await manager().waitFor();
  await notice().waitFor({ state: "visible" });
  await page.screenshot({ path: join(evidence, "plugin-restart-empty-phone.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 1000 });

  // The notice entry is the 通用 restart flow: same unconfigured unit from GET /api/ui, same disabled state there.
  assert.equal((await api("/ui")).gatewayRestartUnit, null);
  await page.locator("#close-settings").click();
  await openSettings("general");
  await page.locator('#gateway-restart-note[data-status="unconfigured"]').waitFor();
  assert.equal(await page.locator("#gateway-restart").isDisabled(), true);
  await page.locator("#close-settings").click();

  await restartGateway();
  assert.equal((await models()).includes(owned), false);
  assert.equal(await notice().count(), 0);
}
