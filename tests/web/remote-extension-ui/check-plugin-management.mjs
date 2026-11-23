import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { clickPluginSwitch } from "./click-plugin-switch.mjs";

// The one plugin list, driven through the settings page and /api/plugins exactly as the user does; the Gateway's
// pluginsList is the committed state, and every saved change is proven by its effect after a session reload: the
// live SDK command catalog, and commands run through the composer — host location in the target session host,
// gateway location in this process (the in-process Gateway) — with ctx.ui dialogs answered in the browser.
// Provider ownership needs a really bootstrapped Gateway: tests/web/check-plugin-provider-ui.mjs.
export async function checkPluginManagement({ page, client, host, until, name, native, evidence, openSettings, plugins }) {
  const { ui, command } = plugins;
  const sessionCommands = () => page.evaluate(async (name) => (await (await fetch(`/api/sessions/${encodeURIComponent(name)}/native`)).json()).commands.map((item) => item.name), name);
  const manager = () => page.locator('#plugins-manager[aria-busy="false"]');
  const row = (source) => manager().locator(`[data-plugin-source="${source}"]`);
  const list = async () => (await client.request("pluginsList", {})).packages;
  const entry = async (source) => (await list()).find((pkg) => pkg.source === source);
  const mutation = async (path, action) => {
    const received = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === path, { timeout: 120000 });
    await action();
    const response = await received;
    await manager().waitFor();
    return response;
  };
  const reload = async () => {
    const reloaded = await native("reload", {});
    assert.equal(reloaded.httpStatus, 200);
    assert.equal(reloaded.body.status, "completed", JSON.stringify(reloaded.body));
  };
  const runCommand = async (token) => {
    await until(() => host.state(name), (state) => state.state === "idle", "session idle before plugin command");
    const known = new Set(host.state(name).extensionUi.notifications.map((item) => item.id));
    await page.locator("#composer").fill(`/plugin_ui_probe ${token}`);
    await page.locator("#send-message").click();
    const card = page.locator('[data-prompt-kind="confirm"]');
    await card.waitFor({ state: "visible" });
    await card.locator('[data-action="submit"]').click();
    const notice = await until(() => host.state(name).extensionUi.notifications.find((item) => item.message.endsWith(`:${token}:true`)), Boolean, `plugin command ${token} notifies`);
    // An info notify renders as the anchored in-chat line (toasts are only for warning/error, ExtensionToasts TOAST_MS).
    const line = page.locator(`[data-notification-id="${notice.id}"][data-notification-type="info"]`);
    await line.waitFor({ state: "visible" });
    assert.equal(await line.textContent(), notice.message);
    await until(() => host.state(name), (state) => state.state === "idle", `plugin command ${token} settles`);
    const failures = host.state(name).extensionUi.notifications.filter((item) => !known.has(item.id) && item.type === "error");
    assert.deepEqual(failures.map((item) => item.message), [], `plugin command ${token} completes without a transport/handler error`);
    return Number(/^PLUGIN_UI_PROBE:(\d+):/.exec(notice.message)?.[1]);
  };

  await openSettings("plugins");
  await manager().waitFor();
  const initial = await list();
  assert.equal(await manager().locator(".plugin-list").getAttribute("data-count"), String(initial.length));
  for (const pkg of initial) {
    assert.equal(await row(pkg.source).getAttribute("data-location"), pkg.location);
    assert.equal(await row(pkg.source).getAttribute("data-enabled"), String(pkg.enabled));
    assert.equal(await row(pkg.source).getAttribute("data-command-count"), String(pkg.commands.length));
  }
  assert.equal(await row(ui.source).getAttribute("data-location"), "host");
  // Install a local directory: linked by its absolute path, enabled, on the location chosen in the form. The form
  // defaults to the Gateway; the user explicitly picks the session host here, and the form returns to the default.
  assert.equal(await page.locator("#plugin-install-location").inputValue(), "gateway");
  await page.locator("#plugin-install-location").selectOption("host");
  await page.locator("#plugin-source").fill(command.source);
  const installed = await mutation("/api/plugins/install", () => page.locator("#plugin-install").click());
  assert.equal(installed.status(), 200);
  assert.deepEqual(installed.request().postDataJSON(), { source: command.source, location: "host" });
  await row(command.source).waitFor();
  assert.equal(await row(command.source).getAttribute("data-location"), "host");
  assert.equal(await row(command.source).getAttribute("data-enabled"), "true");
  assert.equal(await page.locator("#plugin-source").inputValue(), "");
  assert.equal(await page.locator("#plugin-install-location").inputValue(), "gateway", "the form returns to the default location");
  assert.deepEqual(await entry(command.source).then(({ source, enabled, location }) => ({ source, enabled, location })), { source: command.source, enabled: true, location: "host" });
  await page.locator("#close-settings").click();

  // Saved changes apply on reload: the live session then has the command, the list shows what the host registered,
  // and the command executes.
  assert.equal((await sessionCommands()).includes("plugin_ui_probe"), false, "saving does not hot-load the plugin");
  await reload();
  assert.equal((await sessionCommands()).includes("plugin_ui_probe"), true);
  await until(() => entry(command.source), (pkg) => pkg?.commands.some((item) => item.name === "plugin_ui_probe"), "host command registered");
  const hostPid = await runCommand("host-run");
  assert.ok(Number.isSafeInteger(hostPid) && hostPid !== process.pid, "host location runs in the session host, not the Gateway");

  await openSettings("plugins");
  await manager().waitFor();
  assert.equal(await row(command.source).locator('[data-command="plugin_ui_probe"]').count(), 1);
  assert.equal(await row(command.source).getAttribute("data-command-count"), "1");
  const moved = await mutation("/api/plugins/change", () => row(command.source).locator('[data-action="plugin-location"]').selectOption("gateway"));
  assert.equal(moved.status(), 200);
  assert.deepEqual(moved.request().postDataJSON(), { source: command.source, location: "gateway" });
  assert.equal(await row(command.source).getAttribute("data-location"), "gateway");
  assert.equal((await entry(command.source)).location, "gateway");
  await page.locator("#close-settings").click();
  await reload();
  assert.equal(await runCommand("gateway-run"), process.pid, "gateway location runs in the Gateway process");

  await openSettings("plugins");
  await manager().waitFor();
  const disabled = await mutation("/api/plugins/change", async () => assert.equal(await clickPluginSwitch(row(command.source)), true));
  assert.equal(disabled.status(), 200);
  assert.deepEqual(disabled.request().postDataJSON(), { source: command.source, enabled: false });
  assert.equal(await row(command.source).getAttribute("data-enabled"), "false");
  assert.equal(await row(command.source).getByRole("switch").isChecked(), false);
  assert.equal((await entry(command.source)).enabled, false);
  await page.screenshot({ path: join(evidence, "plugins-desktop.png"), fullPage: true, animations: "disabled" });
  await reload();
  assert.equal((await sessionCommands()).includes("plugin_ui_probe"), false, "a disabled plugin is not loaded after reload");

  // Uninstalling a directory only removes the registration.
  await row(command.source).locator('[data-action="plugin-uninstall"]').click();
  // The Modal root is a zero-size container; its confirm button is what the user sees and clicks.
  await page.locator("#plugin-confirm-uninstall").waitFor({ state: "visible" });
  assert.equal((await mutation("/api/plugins/uninstall", () => page.locator("#plugin-confirm-uninstall").click())).status(), 200);
  await page.locator("#plugin-confirm-uninstall").waitFor({ state: "detached" });
  await row(command.source).waitFor({ state: "detached" });
  assert.equal(await entry(command.source), undefined);
  await access(join(command.source, "package.json"));
  assert.equal(await page.locator('[data-kind="plugin-error"]').count(), 0);

  await page.setViewportSize({ width: 390, height: 844 });
  // The settings window turns full-screen and returns to its section list; reopen the page.
  await page.locator('[data-settings-section="plugins"]').click();
  await manager().waitFor();
  await page.screenshot({ path: join(evidence, "plugins-phone.png"), animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#close-settings").click();
  return { installed: command.source, hostPid };
}
