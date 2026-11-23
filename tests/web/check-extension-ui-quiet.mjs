// Plugin UI side traffic and the error banner (check:full). The page's own plugin-UI requests (render ticks, draft
// sync) go only to a live plugin host and a host that went away in between (`unavailable`) raises no banner; a real
// failure of that traffic, and a failed or unavailable answer to a dialog button the user clicked, still does.
// The API is mocked at the browser; the real web/ is served by Vite. Ids, data-* and classes only, no UI copy.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { snapshotOf } from "../fixtures/workspace-mock/session-snapshots.mjs";

const sessions = [
  { label: "one", sessionId: "w1", state: "idle", target: "alpha", cwd: "/data" },
  { label: "two", sessionId: "w2", state: "idle", target: "alpha", cwd: "/data" },
];
const extensionUi = { revision: 1, autocomplete: false, status: [], notifications: [], working: { visible: false }, editor: { text: "", revision: 0 }, widgets: [] };
const snapshots = Object.fromEntries(sessions.map((worker) => [worker.sessionId, { ...snapshotOf(worker.sessionId, "idle"), extensionUi }]));
// Per session: what its plugin host answers. `live` renders; `gone` answers like the Gateway for a host that is not
// there (sleeping, closed, just replaced); `failing` makes the next draft sync fail the way a plugin error does.
const hosts = { w1: "live", w2: "live" };
const prompts = { w1: [] };
const seen = [];
const native = (name) => (body) => {
  if (body.action !== "extension-ui") return { version: 1, commands: [], actions: [] };
  const answer = (body, status, message, data = {}) => ({ requestId: body.requestId, action: body.action, status, message, data: { streamId: snapshots[name].streamId, ...data } });
  const operation = body.args?.operation;
  seen.push({ name, operation, host: hosts[name] });
  if (hosts[name] === "gone") return answer(body, "unavailable", "Extension UI requires an active selected session.", { executed: false });
  if (hosts[name] === "failing" && operation === "editor") return answer(body, "failed", "PLUGIN_EDITOR_FAILURE", { outcomeUnknown: true });
  if (operation === "dialog") return answer(body, "unavailable", "Dialog is no longer active.", { status: "unavailable", extensionUi });
  if (operation === "render") return answer(body, "completed", "ok", { revision: 2, status: [], notifications: [], widgets: [], prompts: prompts[name] ?? [], tools: {}, toolErrors: {}, rendererErrors: [], messages: {}, entries: [] });
  return answer(body, "completed", "ok", { status: "completed", extensionUi });
};
const routes = Object.fromEntries(sessions.map((worker) => [`/api/sessions/${worker.sessionId}/native`, native(worker.sessionId)]));

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
const banner = (page) => page.locator("#chat-error");
const noBanner = async (page, label) => { await page.waitForTimeout(500); assert.equal(await banner(page).count(), 0, `${label}: no error banner`); };
const type = async (page, text) => { await page.locator("#composer").click(); await page.keyboard.type(text, { delay: 15 }); await page.waitForTimeout(400); };
const editorSyncs = (name) => seen.filter((entry) => entry.name === name && entry.operation === "editor").length;
const hostEvent = (page, name, event) => page.evaluate(({ name: worker, event: payload }) => {
  const source = window.__eventSources.findLast((candidate) => candidate.url.endsWith(`/sessions/${worker}/events`));
  source.dispatchEvent(new MessageEvent("host", { data: JSON.stringify(payload) }));
}, { name, event });
try {
  const { context, page, problems } = await openMockWorkbench(browser, server.url, { sessions, snapshots, routes });
  await selectSession(page, "w1");
  await page.locator(".pi-tray").waitFor({ state: "attached" });
  for (let tries = 0; !seen.some((entry) => entry.name === "w1" && entry.operation === "render") && tries < 50; tries += 1) await page.waitForTimeout(100);
  await type(page, "a");
  assert.ok(editorSyncs("w1") > 0, "a live session syncs the draft to the plugin host");

  // The session falls asleep while selected: its host is gone. Typing sends nothing and shows nothing.
  hosts.w1 = "gone";
  await hostEvent(page, "w1", { type: "state_changed", streamId: snapshots.w1.streamId, sessionId: "w1", sequence: 50, details: { state: "sleeping" } });
  await page.waitForTimeout(200);
  const before = seen.length;
  await type(page, "bc");
  assert.equal(seen.slice(before).filter((entry) => entry.name === "w1" && ["editor", "render"].includes(entry.operation)).length, 0, "no plugin-UI side request to a sleeping session");
  await noBanner(page, "typing in a sleeping session");

  // The host goes away while the page still thinks the session is awake: the side traffic gets `unavailable`, quietly.
  await hostEvent(page, "w1", { type: "state_changed", streamId: snapshots.w1.streamId, sessionId: "w1", sequence: 51, details: { state: "idle" } });
  await page.waitForTimeout(200);
  const syncsBefore = editorSyncs("w1");
  await type(page, "d");
  assert.ok(editorSyncs("w1") > syncsBefore, "an awake session still syncs the draft");
  assert.ok(seen.some((entry) => entry.name === "w1" && entry.host === "gone"), "and the host answered unavailable");
  await noBanner(page, "unavailable answer to draft sync");

  // Switching to a session whose host is not there (yet): its render ticks are answered unavailable, no banner.
  hosts.w2 = "gone";
  await selectSession(page, "w2");
  for (let tries = 0; !seen.some((entry) => entry.name === "w2" && entry.operation === "render") && tries < 50; tries += 1) await page.waitForTimeout(100);
  assert.ok(seen.some((entry) => entry.name === "w2" && entry.operation === "render" && entry.host === "gone"), "the switched-to session was asked to render and answered unavailable");
  await noBanner(page, "switching sessions");

  // A real failure of the side traffic still shows.
  hosts.w1 = "failing";
  await selectSession(page, "w1");
  await type(page, "f");
  await banner(page).waitFor();
  assert.equal(await banner(page).count(), 1, "a failed draft sync shows the error banner");
  await banner(page).locator("button").click();
  await banner(page).waitFor({ state: "detached" });

  // What the user clicked reports an unavailable answer too: a dialog that is gone by the time the button is pressed.
  hosts.w1 = "live";
  prompts.w1 = [{ id: "p1", kind: "confirm", title: "confirm", message: "m", focused: true }];
  await hostEvent(page, "w1", { type: "extension_ui", streamId: snapshots.w1.streamId, sessionId: "w1", sequence: 52, details: { extensionUi: { ...extensionUi, revision: 3 } } });
  const card = page.locator('.pi-tray > [data-prompt-kind="confirm"]');
  await card.waitFor();
  await card.locator('[data-action="submit"]').click();
  await banner(page).waitFor();
  assert.equal(await banner(page).count(), 1, "a dialog button answered unavailable shows the error banner");
  assert.deepEqual(problems, [], "page errors");
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
console.log("PASS plugin UI side traffic: nothing sent to a sleeping session, unavailable is quiet, failures and clicked dialogs still report");
