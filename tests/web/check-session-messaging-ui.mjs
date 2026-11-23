// Real Chromium + Vite, mocked API (tests/fixtures/session-messaging-mock.mjs): session_* tool rows (session_send
// summary, session_list as a relation list through tool_call), root / supervisor marks in the sidebar and session
// details, pending transfers, and the user's control actions (designate root, promote supervisor, transfer a child)
// behind confirmation, checked fresh, after saving + reload, and after use + reload.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { TARGETS, createSessionMessagingState, initialSessions, install, snapshotsFor } from "../fixtures/session-messaging-mock.mjs";
import { closeSessionDetails, openSessionDetails } from "../fixtures/session-details.mjs";

const state = createSessionMessagingState();
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  const h = await openMockWorkbench(browser, server.url, { sessions: initialSessions(), snapshots: snapshotsFor(initialSessions()), targets: TARGETS, beforeGoto: (page) => install(page, state) });
  const { page } = h;
  const row = (name) => page.locator(`.management-session-row[data-session-id="${name}"]`);
  const roles = async (name) => (await row(name).locator(".pi-role-badge").evaluateAll((nodes) => nodes.map((node) => node.dataset.role)));
  const menu = async (name, item) => { await row(name).locator('[data-action="session-menu"]').click(); await page.locator(`#${item}`).click(); };
  const dialog = (kind) => page.locator(`#management-dialog[data-kind="${kind}"]`);
  const reload = async () => { await page.reload(); await row("s1").waitFor(); };
  try {
    // Fresh: marks come from the workbench snapshot's sessionControl, matched by native session id.
    await row("s1").locator('[data-role="root"]').waitFor();
    assert.deepEqual(await roles("s1"), ["root", "supervisor"]);
    for (const name of ["s4", "s5", "s6", "s7"]) assert.deepEqual(await roles(name), [], `${name} has no role`);
    assert.equal(await row("s6").getAttribute("data-pending-owner"), "s4", "a pending transfer is marked on the child row");

    // Transcript of k1: session_send with its recipient, session_list as a structured list (reached via tool_call).
    await selectSession(page, "s5");
    for (const fold of await page.locator("details.pi-turn-process:not([open]) > summary").all()) await fold.click();
    const send = page.locator('.pi-tool[data-tool-name="session_send"]');
    assert.match(await send.locator(".pi-tool-args").textContent(), /Lead/, "session_send names the recipient session");
    const list = page.locator('.pi-tool[data-tool-name="session_list"][data-tool-key$=":l1"]');
    assert.equal(await list.getAttribute("data-via"), "tool_call");
    assert.equal(await page.locator('.pi-tool[data-tool-name="tool_call"]').count(), 0);
    await list.locator(":scope > summary").click();
    const entries = list.locator(".pi-session-list");
    await entries.waitFor();
    assert.equal(await entries.getAttribute("data-count"), "4");
    assert.equal(await list.locator('.pi-io > [data-kind], .pi-io .code-block').count(), 0, "no raw JSON body");
    const entry = (name) => entries.locator(`.pi-session-entry[data-session-id="${name}"]`);
    assert.deepEqual(await entry("s1").locator(".pi-role-badge").evaluateAll((nodes) => nodes.map((node) => node.dataset.role)), ["root", "supervisor"]);
    assert.equal(await entry("s6").getAttribute("data-owner"), "s1");
    assert.equal(await entry("s6").getAttribute("data-pending-owner"), "s4");
    assert.equal(await entry("s6").locator('[data-field="pending-owner"]').count(), 1);
    assert.match(await entry("s6").locator('[data-field="owner"]').textContent(), /Lead/);
    assert.match(await entry("s6").locator('[data-field="pending-owner"]').textContent(), /Second/);
    assert.equal(await entries.locator("[data-project], [data-created-by]").count(), 0, "Compact rows carry no creator/project payload");
    assert.equal(await entry("s7").locator(".pi-role-badge").count(), 0);
    const legacy = page.locator('.pi-tool[data-tool-key$=":legacy-list"]');
    await legacy.locator(":scope > summary").click();
    assert.equal(await legacy.locator(".pi-session-list").count(), 0, "retired name-keyed rows use the generic output instead of a session roster");
    assert.equal(await legacy.locator('.pi-io[data-kind="session_list"]').count(), 1, "the historical payload remains visible");
    const observed = page.locator('.pi-tool[data-tool-key$=":observe-list"]');
    await observed.locator(":scope > summary").click();
    assert.equal(await observed.locator(".pi-session-list").count(), 0, "An observation is not mistaken for a default roster");
    const output = await observed.locator('.pi-io[data-kind="session_list"] .output-block').textContent();
    assert(output.includes("LIVE_OBSERVATION_UI_7319") && output.includes("kernel_code"), "Observation uses the generic structured-output body");

    // Session details: roles and the pending transfer.
    await openSessionDetails(page, "s1", { touch: false });
    assert.equal(await page.locator('#session-roles').getAttribute("data-count"), "2");
    await closeSessionDetails(page);
    await openSessionDetails(page, "s6", { touch: false });
    assert.equal(await page.locator("#session-pending-owner").getAttribute("data-session-id"), "s4");
    assert.equal(await page.locator('#session-roles').getAttribute("data-count"), "0");
    await closeSessionDetails(page);

    // Root: only local sessions qualify; confirmation shows the current and the new holder; cancel changes nothing.
    await row("s7").locator('[data-action="session-menu"]').click();
    assert.equal(await page.locator("#set-root-session").isDisabled(), true, "a non-local session cannot be root");
    await page.keyboard.press("Escape");
    await menu("s4", "set-root-session");
    assert.equal(await dialog("root").locator('[data-holder="from"]').getAttribute("data-session-id"), "s1");
    assert.equal(await dialog("root").locator('[data-holder="to"]').getAttribute("data-session-id"), "s4");
    await dialog("root").locator('[data-action="cancel"]').click();
    await dialog("root").waitFor({ state: "hidden" });
    assert.equal(state.posts.length, 0, "cancel sends nothing");
    await menu("s4", "set-root-session");
    await page.locator('#confirm-session-role[data-role="root"]').click();
    await dialog("root").waitFor({ state: "hidden" });
    assert.deepEqual(state.posts.at(-1), { path: "/session-control/root", body: { sessionId: "s4" } });
    await row("s4").locator('[data-role="root"]').waitFor();
    assert.deepEqual(await roles("s1"), ["supervisor"], "root moved away");
    // Saved, then reloaded.
    await reload();
    await row("s4").locator('[data-role="root"]').waitFor();
    assert.deepEqual(await roles("s1"), ["supervisor"]);

    // Supervisor: only for project members; promoting replaces the project's supervisor.
    await row("s7").locator('[data-action="session-menu"]').click();
    assert.equal(await page.locator("#set-project-supervisor").isDisabled(), true, "a session outside any project cannot be supervisor");
    await page.keyboard.press("Escape");
    await menu("s5", "set-project-supervisor");
    assert.equal(await dialog("supervisor").locator('[data-holder="from"]').getAttribute("data-session-id"), "s1");
    await page.locator('#confirm-session-role[data-role="supervisor"]').click();
    await dialog("supervisor").waitFor({ state: "hidden" });
    assert.deepEqual(state.posts.at(-1), { path: "/session-control/supervisor", body: { sessionId: "s5" } });
    await row("s5").locator('[data-role="supervisor"]').waitFor();
    assert.deepEqual(await roles("s1"), []);

    // Roles changed elsewhere (IM gateway / a root model): the collection event carries the new designations.
    state.control = { ...state.control, rootSessionId: "s1" };
    await page.evaluate((sessionControl) => {
      const source = window.__eventSources.find((item) => /\/sessions\/events$/.test(item.url));
      source.dispatchEvent(new MessageEvent("collection", { data: JSON.stringify({ type: "session_control_changed", sessionId: "s1", timestamp: new Date().toISOString(), details: { sessionControl } }) }));
    }, state.control);
    await row("s1").locator('[data-role="root"]').waitFor();
    assert.deepEqual(await roles("s4"), []);

    // Transfer a child: pick the new parent, confirm, and the child moves under it.
    await menu("s5", "manage-derived-session");
    await dialog("derivation").locator(".mantine-Select-input").click();
    await page.locator('[role="option"][value="s4"]').click();
    await page.locator("#transfer-derived-session").click();
    const confirm = dialog("derivation").locator('[data-stage="confirm-transfer"]');
    await confirm.waitFor();
    assert.equal(await confirm.locator('[data-holder="from"]').getAttribute("data-session-id"), "s1");
    assert.equal(await confirm.locator('[data-holder="to"]').getAttribute("data-session-id"), "s4");
    await confirm.locator("#confirm-transfer").click();
    await dialog("derivation").waitFor({ state: "hidden" });
    assert.deepEqual(state.posts.at(-1), { path: "/sessions/s5/manage", body: { action: "transfer", owner: "s4" } });
    // The Gateway publishes the changed row; the page moves the child from that event alone.
    await page.evaluate((row) => {
      const source = window.__eventSources.find((item) => /\/sessions\/events$/.test(item.url));
      source.dispatchEvent(new MessageEvent("collection", { data: JSON.stringify({ type: "session_derivation_changed", sessionId: row.sessionId, timestamp: new Date().toISOString(), details: { session: row } }) }));
    }, state.sessions.find((entry) => entry.sessionId === "s5"));
    const under = (parent, child) => page.locator(`.management-tree-node:has(> [data-session-id="${parent}"]) > .management-session-children [data-session-id="${child}"]`);
    await under("s4", "s5").waitFor();
    // Used, then reloaded: relations and roles are what the backend holds.
    await reload();
    await under("s4", "s5").waitFor();
    assert.deepEqual(await roles("s5"), ["supervisor"]);
    assert.deepEqual(await roles("s1"), ["root"]);
    assert.deepEqual(h.problems, [], "no page errors");
    console.log("PASS session messaging UI: session_* rows, session_list relations, root/supervisor marks, confirmed root/supervisor/transfer actions, state after reload");
  } finally { await h.context.close(); }
} finally {
  await browser.close();
  await server.close();
}
