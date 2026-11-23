// Real Chromium + Vite, mocked API: the three-way pill switch (.prk-tri-switch) in the tool settings (global, instance
// and session windows) is drawn from the catalog's `enabled` + `lazy` fields, writes through batch capability changes
// (`changes: [{ id, enabled }, ...]`, `enabled: null` resets instance/session overrides) and shows what the backend
// reports after a reload.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { snapshotOf, SESSIONS } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { assembleLazySwitchMock } from "../fixtures/capability-ui/assemble-lazy-switch-mock.mjs";

const { GROUP, layers, posts, beforeGoto, routes } = assembleLazySwitchMock();

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();

/** Left and right x of every three-way switch track in the shown provider section: group header first, then the rows. */
const switchColumns = (page, scope) => page.locator(`${scope} [data-provider-section="${GROUP}"]`).last().evaluate((section) => {
  const x = (node) => node ? Math.round(node.getBoundingClientRect().left * 10) / 10 : null;
  const group = section.querySelector(".capability-group");
  const rows = [...section.querySelectorAll(".capability-row")];
  return {
    track: [group, ...rows].map((node) => x(node.querySelector(".prk-tri-switch .tri-track"))),
    slot: [group, ...rows].map((node) => x(node.querySelector(".capability-override"))),
  };
});
const assertAligned = (columns, label) => {
  for (const [name, xs] of Object.entries(columns)) {
    assert(xs.every((value) => value !== null), `${label}: every row has a ${name}`);
    assert(Math.max(...xs) - Math.min(...xs) <= 1, `${label}: group and row ${name}s share one column (${xs.join(", ")})`);
  }
};

try {
  const h = await openMockWorkbench(browser, server.url, { sessions: SESSIONS.slice(0, 1), snapshots: { w1: snapshotOf("w1", "idle") }, routes, beforeGoto, search: "#sessionId=w1" });
  const { page } = h;
  const entryRow = (scope, name) => page.locator(`${scope} .capability-row[data-capability="tool:${name}"]`);
  const modeNode = (scope, name) => entryRow(scope, name).locator(".capability-mode");
  const stopBtn = (scope, name, stop) => entryRow(scope, name).locator(`.prk-tri-switch [data-stop="${stop}"]`);
  const groupHeader = (scope) => page.locator(`${scope} .capability-group[data-capability-group="${GROUP}"]`);
  const groupMode = (scope) => groupHeader(scope).locator(".capability-mode");
  const groupStop = (scope, stop) => groupHeader(scope).locator(`.prk-tri-switch [data-stop="${stop}"]`);
  const pickProvider = async (scope) => { await page.locator(`${scope} .capability-provider[data-provider="${GROUP}"]`).click(); await groupHeader(scope).waitFor(); };
  const idle = (scope) => page.locator(`${scope} .capabilities-panel[aria-busy="false"]`).waitFor();
  const openGlobal = async () => { await page.locator("#open-settings").click(); await page.locator('[data-settings-section="tools"]').click(); await idle("#settings-dialog"); await pickProvider("#settings-dialog"); };
  const openInstance = async () => { await page.locator('[data-action="instance-menu"]').first().click(); await page.locator('[data-action="instance-settings"]').click(); await page.locator('[data-instance-tab="tools"]').click(); await idle("#instance-settings"); await pickProvider("#instance-settings"); };
  const openSession = async () => { await page.locator('[data-session-id="w1"] [data-action="session-menu"]').click(); await page.locator("#session-tools").click(); await idle("#session-capabilities-dialog"); await pickProvider("#session-capabilities-dialog"); };
  const reload = async () => { await page.reload(); await page.locator("#composer").waitFor(); };
  try {
    await selectSession(page, "w1");

    // Global, fresh: probe_a is resident, probe_model is resident with lazy disabled, probe_off is off (lazy offered!).
    await openGlobal();
    const G = "#settings-dialog";
    assert.equal(await modeNode(G, "probe_a").getAttribute("data-mode"), "resident");
    assert.equal(await modeNode(G, "probe_a").getAttribute("data-lazy-available"), "true");
    assert.equal(await modeNode(G, "probe_model").getAttribute("data-mode"), "resident");
    assert.equal(await stopBtn(G, "probe_model", "lazy").isDisabled(), true, "model-only tool cannot be lazy");
    assert.equal(await modeNode(G, "probe_off").getAttribute("data-mode"), "off");
    assert.equal(await stopBtn(G, "probe_off", "lazy").isDisabled(), false, "a disabled tool offers lazy so one click enables + sets lazy");
    assert.equal(await groupMode(G).getAttribute("data-mode"), "mixed", "members disagree (resident vs off) -> group is mixed");
    assertAligned(await switchColumns(page, G), "desktop global");
    await entryRow(G, "probe_model").locator(".tri-zone-wrap").hover();
    await page.locator('[role="tooltip"]').waitFor();
    assert.equal(await page.locator(`${G} [data-action="restore-default"]`).count(), 0, "global scope has no reset");

    // Clicking lazy on probe_a writes lazy:tool:probe_a = true.
    await stopBtn(G, "probe_a", "lazy").click();
    await page.locator(`${G} .capability-row[data-capability="tool:probe_a"] .capability-mode[data-mode="lazy"]`).waitFor();
    assert.deepEqual(posts.at(-1), { changes: [{ id: "lazy:tool:probe_a", enabled: true }] }, "global write uses the lazy id on the capability route");

    // Clicking lazy directly on disabled probe_off sends BOTH enable and lazy in one batch request!
    await stopBtn(G, "probe_off", "lazy").click();
    await page.locator(`${G} .capability-row[data-capability="tool:probe_off"] .capability-mode[data-mode="lazy"]`).waitFor();
    assert.deepEqual(posts.at(-1), { changes: [{ id: "tool:probe_off", enabled: true }, { id: "lazy:tool:probe_off", enabled: true }] }, "off -> lazy sends enable + lazy in a single batch");
    // Restore probe_off back to off for subsequent layer checks.
    delete layers.global["tool:probe_off"];
    delete layers.global["lazy:tool:probe_off"];

    // Saved, then reloaded: the backend state is shown.
    await reload();
    await openGlobal();
    assert.equal(await modeNode(G, "probe_a").getAttribute("data-mode"), "lazy", "saved global lazy setting survives a reload");
    await page.locator("#close-settings").click();

    // Instance: inherits the global value; an own value is an override with a ↺ reset back to the inherited value.
    await openInstance();
    const I = "#instance-settings";
    assert.equal(await modeNode(I, "probe_a").getAttribute("data-mode"), "lazy", "instance inherits the global lazy setting");
    assert.equal(await entryRow(I, "probe_a").locator('[data-overridden="true"]').count(), 0);
    await stopBtn(I, "probe_a", "on").click();
    await entryRow(I, "probe_a").locator('[data-overridden="true"]').waitFor();
    assert.equal(await modeNode(I, "probe_a").getAttribute("data-mode"), "resident");
    assert.deepEqual(posts.at(-1), { instance: "alpha", changes: [{ id: "lazy:tool:probe_a", enabled: false }] });
    await entryRow(I, "probe_a").locator('[data-action="restore-default"]').click();
    await page.locator(`${I} .capability-row[data-capability="tool:probe_a"] .capability-mode[data-mode="lazy"]`).waitFor();
    assert.equal(await entryRow(I, "probe_a").locator('[data-overridden="true"]').count(), 0);
    assert.deepEqual(posts.at(-1), { instance: "alpha", changes: [{ id: "lazy:tool:probe_a", enabled: null }] }, "reset sends null");
    // Used, then reloaded: the reset entry is inherited again.
    await reload();
    await openInstance();
    assert.equal(await entryRow(I, "probe_a").locator('[data-overridden="true"]').count(), 0, "reset entry stays inherited after a reload");
    assert.equal(await modeNode(I, "probe_a").getAttribute("data-mode"), "lazy");

    // Group lazy override at the instance layer: shown (with its reset) on the group row only; entries follow the
    // group's value without being marked.
    await groupStop(I, "lazy").click();
    await groupHeader(I).locator('[data-overridden="true"]').waitFor();
    assert.deepEqual(posts.at(-1), { instance: "alpha", changes: [{ id: `lazy:${GROUP}`, enabled: true }] });
    await groupStop(I, "on").click();
    await page.locator(`${I} .capability-row[data-capability="tool:probe_a"] .capability-mode[data-mode="resident"]`).waitFor();
    assert.equal(await groupHeader(I).locator('[data-action="restore-default"]').count(), 1, "the group row resets its own override");
    assert.equal(await page.locator(`${I} [data-provider-section="${GROUP}"] .capability-rows [data-overridden]`).count(), 0, "entries following the group are not marked");

    // Overriding both lazy and enabled on probe_a, then clicking ↺ once clears both in a single batch!
    await stopBtn(I, "probe_a", "lazy").click();
    await page.locator(`${I} .capability-row[data-capability="tool:probe_a"] .capability-mode[data-mode="lazy"]`).waitFor();
    await stopBtn(I, "probe_a", "off").click();
    await page.locator(`${I} .capability-row[data-capability="tool:probe_a"] .capability-mode[data-mode="off"]`).waitFor();
    assert.deepEqual(posts.at(-1), { instance: "alpha", changes: [{ id: "tool:probe_a", enabled: false }] });
    const layout = await page.locator(`${I} [data-provider-section="${GROUP}"] .capability-rows`).evaluate((rows) => {
      const probe = rows.querySelector('[data-capability="tool:probe_a"]');
      const slot = probe.querySelector('.capability-override[data-slot="mode"]');
      const btn = slot?.querySelector('[data-action="restore-default"][data-overridden="true"]');
      const right = (selector) => [...rows.querySelectorAll(selector)].map((node) => Math.round(node.getBoundingClientRect().right));
      return {
        trackNext: Boolean(slot?.nextElementSibling?.classList.contains("tri-track")),
        iconOnly: Boolean(btn?.querySelector("svg") && !btn.textContent.trim()),
        hasLabel: Boolean(btn?.getAttribute("aria-label")) && btn.getAttribute("title") === btn.getAttribute("aria-label"),
        emptySlots: rows.querySelectorAll(".capability-override:empty").length,
        slotWidths: new Set([...rows.querySelectorAll(".capability-override")].map((node) => Math.round(node.getBoundingClientRect().width))).size,
        trackColumns: new Set(right(".prk-tri-switch .tri-track")).size,
      };
    });
    assert.deepEqual({ ...layout, emptySlots: layout.emptySlots > 0 }, { trackNext: true, iconOnly: true, hasLabel: true, emptySlots: true, slotWidths: 1, trackColumns: 1 },
      "reset is an icon in a fixed slot left of the pill track; empty slots keep the switch columns aligned");
    await entryRow(I, "probe_a").locator('[data-action="restore-default"]').click();
    await entryRow(I, "probe_a").locator('[data-overridden="true"]').waitFor({ state: "detached" });
    assert.deepEqual(posts.at(-1), { instance: "alpha", changes: [{ id: "tool:probe_a", enabled: null }, { id: "lazy:tool:probe_a", enabled: null }] },
      "clicking ↺ once clears both enable and lazy overrides in one batch");
    await groupHeader(I).locator('[data-action="restore-default"]').click();
    await groupHeader(I).locator('[data-overridden="true"]').waitFor({ state: "detached" });

    // A saved lazy override on a tool whose inherited enabled is false: the reset is shown but disabled.
    layers.instance["lazy:tool:probe_off"] = true;
    await page.locator("#close-instance-settings").click();
    await openInstance();
    const offReset = entryRow(I, "probe_off").locator('[data-action="restore-default"][data-lazy-overridden="true"]');
    await offReset.waitFor();
    assert.equal(await offReset.isDisabled(), true, "unavailable lazy setting on disabled tool: reset disabled");
    delete layers.instance["lazy:tool:probe_off"];
    await page.locator("#close-instance-settings").click();

    // Session: its own layer over instance + global, same override/reset interaction through the native action.
    await openSession();
    const S = "#session-capabilities-dialog";
    await stopBtn(S, "probe_a", "on").click();
    await entryRow(S, "probe_a").locator('[data-overridden="true"]').waitFor();
    assert.deepEqual(posts.at(-1), { session: true, changes: [{ id: "lazy:tool:probe_a", enabled: false }] });
    await page.locator("#close-session-capabilities").click();
    await reload();
    await openSession();
    assert.equal(await entryRow(S, "probe_a").locator('[data-overridden="true"]').count(), 1, "session override survives a reload");
    await entryRow(S, "probe_a").locator('[data-action="restore-default"]').click();
    await entryRow(S, "probe_a").locator('[data-overridden="true"]').waitFor({ state: "detached" });
    assert.deepEqual(posts.at(-1), { session: true, changes: [{ id: "lazy:tool:probe_a", enabled: null }] });
    assertAligned(await switchColumns(page, S), "desktop session");
    assert.deepEqual(h.problems, [], "no page errors");
    console.log("PASS lazy switches: three-way pill switch, batch write/reset in global/instance/session, state after reload");
  } finally { await h.context.close(); }
  // Phone: the provider opens as a sheet with its own gutter; the columns still line up.
  const phone = await openMockWorkbench(browser, server.url, { sessions: SESSIONS.slice(0, 1), snapshots: { w1: snapshotOf("w1", "idle") }, routes, beforeGoto, search: "#sessionId=w1", viewport: { width: 390, height: 844 }, mobile: true });
  try {
    layers.session["lazy:tool:probe_a"] = false;
    await phone.page.locator("#open-sidebar").click();
    await phone.page.locator('[data-session-id="w1"] [data-action="session-menu"]').click();
    await phone.page.locator("#session-tools").click();
    await phone.page.locator(`#session-capabilities-dialog .capability-provider[data-provider="${GROUP}"]`).click();
    await phone.page.locator('#capability-sheet[aria-hidden="false"] .capability-group').waitFor();
    await phone.page.locator('#capability-sheet .capability-row[data-capability="tool:probe_a"] [data-action="restore-default"]').waitFor();
    assertAligned(await switchColumns(phone.page, "#capability-sheet"), "phone session sheet");
    assert.deepEqual(phone.problems, [], "phone: no page errors");
    console.log("PASS lazy switches: group and row three-way switches share columns on desktop and phone");
  } finally { delete layers.session["lazy:tool:probe_a"]; await phone.context.close(); }
} finally {
  await browser.close();
  await server.close();
}
