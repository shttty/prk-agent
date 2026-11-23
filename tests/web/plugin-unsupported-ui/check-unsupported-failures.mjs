import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const MEMBER = "tool.prepareArguments";

// Every failure is asserted by its structured attributes (data-code / data-member) and matched against the raw HTTP
// envelope or list fields, which are saved as evidence. No copy is asserted.
export async function checkUnsupportedFailures({ page, api, evidence, prepared, later, openSettings, editLater, stopGateway, startGateway }) {
  const raw = {};
  const manager = () => page.locator('#plugins-manager[aria-busy="false"]');
  const row = (source) => manager().locator(`[data-plugin-source="${source}"]`);
  const shot = async (name) => page.screenshot({ path: join(evidence, name), fullPage: true, animations: "disabled" });
  const post = async (path, action) => {
    const received = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === path, { timeout: 120000 });
    received.catch(() => {});
    await action();
    const response = await received;
    await manager().waitFor();
    return { status: response.status(), request: response.request().postDataJSON(), body: await response.json() };
  };
  const reopen = async () => { await page.reload(); await openSettings("plugins"); await manager().waitFor(); };
  const shown = async (locator) => ({ code: await locator.getAttribute("data-code"), member: await locator.getAttribute("data-member") });
  await openSettings("plugins");
  await manager().waitFor();

  // 1. Host install: rejected with the envelope's own code and member; nothing is saved.
  await page.locator("#plugin-install-location").selectOption("host");
  await page.locator("#plugin-source").fill(prepared);
  raw.hostInstall = await post("/api/plugins/install", () => page.locator("#plugin-install").click());
  assert.deepEqual(raw.hostInstall.request, { source: prepared, location: "host" });
  assert.equal(raw.hostInstall.status >= 400, true);
  assert.equal(raw.hostInstall.body.code, "UNSUPPORTED");
  assert.equal(raw.hostInstall.body.details?.member, MEMBER);
  await page.locator("#plugin-error").waitFor({ state: "visible" });
  assert.deepEqual(await shown(page.locator("#plugin-error")), { code: "UNSUPPORTED", member: MEMBER });
  assert.equal(await page.locator("#plugin-source").inputValue(), prepared);
  assert.equal(await page.locator("#plugin-install-location").inputValue(), "host", "the user's choice is kept, not changed");
  assert.equal((await api("/plugins")).body.packages.some((pkg) => pkg.source === prepared), false);
  await shot("unsupported-host-install-desktop.png");

  // 2. Gateway install works; moving it to the host is refused on its row and the location stays.
  await page.locator("#plugin-install-location").selectOption("gateway");
  raw.gatewayInstall = await post("/api/plugins/install", () => page.locator("#plugin-install").click());
  assert.equal(raw.gatewayInstall.status, 200);
  await row(prepared).waitFor();
  raw.moveToHost = await post("/api/plugins/change", () => row(prepared).locator('[data-action="plugin-location"]').selectOption("host"));
  assert.deepEqual(raw.moveToHost.request, { source: prepared, location: "host" });
  assert.equal(raw.moveToHost.status >= 400, true);
  assert.deepEqual({ code: raw.moveToHost.body.code, member: raw.moveToHost.body.details?.member }, { code: "UNSUPPORTED", member: MEMBER });
  const rowFailure = row(prepared).locator('[data-kind="plugin-change-error"]');
  await rowFailure.waitFor({ state: "visible" });
  assert.deepEqual(await shown(rowFailure), { code: "UNSUPPORTED", member: MEMBER });
  assert.equal(await row(prepared).getAttribute("data-location"), "gateway");
  assert.equal(await row(prepared).locator('[data-action="plugin-location"]').inputValue(), "gateway");
  assert.equal((await api("/plugins")).body.packages.find((pkg) => pkg.source === prepared).location, "gateway");
  await shot("unsupported-move-host-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-settings-section="plugins"]').click();
  await manager().waitFor();
  raw.moveToHostPhone = await post("/api/plugins/change", () => row(prepared).locator('[data-action="plugin-location"]').selectOption("host"));
  await row(prepared).locator('[data-kind="plugin-change-error"][data-code="UNSUPPORTED"]').waitFor({ state: "visible" });
  await row(prepared).scrollIntoViewIfNeeded();
  await shot("unsupported-move-host-phone.png");
  await page.setViewportSize({ width: 1440, height: 1000 });

  // 3. A clean host plugin is saved; its linked directory then gains the member. The next real host load rejects only
  //    that package and the list carries error/errorCode/errorDetails, shown on its row; the location is not changed.
  await page.locator('[data-settings-section="plugins"]').click();
  await manager().waitFor();
  await page.locator("#plugin-install-location").selectOption("host");
  await page.locator("#plugin-source").fill(later);
  raw.laterInstall = await post("/api/plugins/install", () => page.locator("#plugin-install").click());
  assert.equal(raw.laterInstall.status, 200, JSON.stringify(raw.laterInstall.body));
  await editLater();
  raw.listAfterEdit = (await api("/plugins")).body;
  const listed = raw.listAfterEdit.packages.find((pkg) => pkg.source === later);
  assert.equal(listed.location, "host");
  assert.equal(typeof listed.error, "string");
  assert.deepEqual({ code: listed.errorCode, member: listed.errorDetails?.member }, { code: "UNSUPPORTED", member: MEMBER });
  assert.equal(raw.listAfterEdit.packages.find((pkg) => pkg.source === prepared).error, undefined, "other plugins are unaffected");
  await reopen();
  const listedFailure = row(later).locator('[data-kind="plugin-error"]');
  await listedFailure.waitFor({ state: "visible" });
  assert.deepEqual(await shown(listedFailure), { code: "UNSUPPORTED", member: MEMBER });
  assert.equal(await row(later).getAttribute("data-location"), "host");
  assert.equal(await row(prepared).locator('[data-kind="plugin-error"]').count(), 0);
  await shot("unsupported-listed-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-settings-section="plugins"]').click();
  await manager().waitFor();
  await row(later).scrollIntoViewIfNeeded();
  await shot("unsupported-listed-phone.png");
  await page.setViewportSize({ width: 1440, height: 1000 });

  // 4. The list cannot load while the Gateway is down: the page shows the envelope's code instead of an empty list.
  await stopGateway();
  const listing = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/plugins");
  await page.reload();
  await openSettings("plugins");
  const failed = await listing;
  raw.listDown = { status: failed.status(), body: await failed.json() };
  assert.equal(raw.listDown.status >= 400, true);
  await page.locator("#plugin-error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#plugin-error").getAttribute("data-code"), raw.listDown.body.code);
  assert.equal(await page.locator("#plugins-empty").count(), 0);
  await shot("list-load-failed-desktop.png");
  await startGateway();
  await writeFile(join(evidence, "raw-envelopes.json"), JSON.stringify(raw, null, 2));
}
