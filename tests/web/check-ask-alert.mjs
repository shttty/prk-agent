// The "an ask is waiting" reminder (mocked API; check:full): while any session's ask waits and the page is not in front
// the tab title carries a mark that goes on return or when nothing waits any more; a system notification per waiting
// session is raised only when the user switched it on in settings (its click selects that session), and the switch is
// disabled where the browser cannot notify. The sidebar row, the collapsed group and (phone) the drawer show who waits.
// The same page also proves what the card posts back (`dialog {answers}`). Nothing here locates by UI copy.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { snapshotOf } from "../fixtures/workspace-mock/session-snapshots.mjs";

const ASK = { id: "dialog-1", kind: "ask", title: "", questions: [
  { id: "db", question: "Which database?", recommended: 1, options: [{ label: "SQLite" }, { label: "Postgres" }] },
  { id: "tz", question: "Which zone?", options: [{ label: "UTC" }] },
] };
const scalar = (revision, prompts) => ({ revision, autocomplete: false, status: [], notifications: [], working: { visible: false }, editor: { text: "", revision: 0 }, widgets: [], prompts });
const sessions = [{ label: "asking worker", sessionId: "m1", state: "idle", target: "alpha", cwd: "/data", asking: true }];
const snapshots = { m1: { ...snapshotOf("m1", "idle"), extensionUi: scalar(1, [ASK]) } };

let answered = false;
const posted = [];
const routes = { "/api/sessions/m1/native": (body) => {
  if (body.action !== "extension-ui") return { version: 1, commands: [], actions: [] };
  const reply = (data) => ({ requestId: body.requestId, action: body.action, status: "completed", message: "ok", data: { streamId: snapshots.m1.streamId, ...data } });
  if (body.args.operation === "render") return reply({ ...scalar(2, answered ? [] : [ASK]), tools: {}, toolErrors: {}, rendererErrors: [], messages: {}, entries: [] });
  if (body.args.operation === "dialog") { posted.push(body.args); answered = true; return reply({ status: "completed", extensionUi: scalar(5, []) }); }
  return reply({ status: "completed", extensionUi: scalar(answered ? 5 : 1, answered ? [] : [ASK]) });
} };

/** A page that is "in the background" or "in front" as far as the document can tell. */
const setFront = (page, front) => page.evaluate((visible) => {
  if (!window.__faked) {
    window.__faked = true;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (window.__front === false ? "hidden" : "visible") });
    document.hasFocus = () => window.__front !== false;
  }
  window.__front = visible;
  document.dispatchEvent(new Event("visibilitychange"));
}, front);
const FAKE_NOTIFICATION = (permission) => {
  window.__notes = [];
  const instances = [];
  class FakeNotification {
    constructor(title, options) { this.entry = { title, ...options, closed: false }; window.__notes.push(this.entry); instances.push(this); }
    close() { this.entry.closed = true; }
    static permission = permission;
    static async requestPermission() { FakeNotification.permission = "granted"; return "granted"; }
  }
  window.__clickNote = (index) => instances[index].onclick?.();
  window.Notification = FakeNotification;
};
/** A live workbench frame, as the Gateway pushes it. */
const push = (page, payload) => page.evaluate((value) => {
  const source = window.__eventSources.find((candidate) => candidate.url.endsWith("/sessions/events"));
  source.dispatchEvent(new MessageEvent("collection", { data: JSON.stringify(value) }));
}, payload);
const asking = (name, value) => ({ type: "session_ask", sessionId: name, details: { asking: value } });
const markedTitle = async (page, base) => (await page.title()) !== base && (await page.title()).endsWith(base);

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  answered = false;
  const { context, page, problems } = await openMockWorkbench(browser, server.url, { sessions, snapshots, routes });
  await context.addInitScript(FAKE_NOTIFICATION, "default");
  await page.reload();
  await selectSession(page, "m1");
  await page.locator(".pi-ask").waitFor();
  const base = await page.title();
  const marked = () => markedTitle(page, base);

  // In front: no mark. In the background: marked, and no notification while the setting is off.
  await page.waitForTimeout(100);
  assert.equal(await page.title(), base);
  await setFront(page, false);
  assert.equal(await marked(), true, "background: the title is marked");
  assert.equal(await page.evaluate(() => window.__notes.length), 0, "no system notification unless switched on");
  await setFront(page, true);
  assert.equal(await page.title(), base, "back in front: the title is restored");

  // Switching the notification on asks the browser's permission and is remembered.
  await page.locator("#open-settings").click();
  assert.equal(await page.locator("#setting-ask-notify").isDisabled(), false, "available in a secure context");
  // Mantine's track lies over the input; a forced click lands on it and toggles the switch.
  await page.locator("#setting-ask-notify").click({ force: true });
  await page.waitForFunction(() => localStorage.getItem("pi.ask.notify") === "1");
  assert.equal(await page.evaluate(() => Notification.permission), "granted");
  await page.keyboard.press("Escape");
  await page.locator("#settings-dialog").waitFor({ state: "hidden" });

  await setFront(page, false);
  await page.waitForFunction(() => window.__notes.length === 1);
  assert.deepEqual(await page.evaluate(() => [window.__notes[0].tag, window.__notes[0].closed]), ["prk-ask:m1", false]);
  await setFront(page, true);
  assert.equal(await page.evaluate(() => window.__notes[0].closed), true, "returning closes the notification");

  // Answering while away clears the mark and the notification. What the card posts back is the typed answer list.
  await setFront(page, false);
  await page.waitForFunction(() => window.__notes.length === 2);
  await page.locator('[data-ask-option="0"]').click();
  await page.locator('[data-ask-tab-button="review"]').click();
  await page.locator('[data-action="ask-submit"]').click();
  await page.locator(".pi-ask").waitFor({ state: "detached" });
  await push(page, asking("m1", false));
  assert.equal(await page.title(), base, "answered: the mark is gone even though the page is still in the background");
  assert.equal(await page.evaluate(() => window.__notes[1].closed), true);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].operation, "dialog");
  assert.equal(posted[0].id, "dialog-1");
  assert.deepEqual(posted[0].answers, [{ id: "db", selected: [0] }, { id: "tz", selected: [] }], "one entry per question in order; the recommended option was only highlighted, never sent");
  assert.deepEqual(problems, [], "page errors");
  await context.close();
  console.log("PASS ask reminder: title mark, opt-in notification, answer payload");

  // Any session, not only the one on screen: rows come from the workbench list, so nothing here depends on the selected
  // session's own stream. w1 hangs under w2 (same group), so folding w2 hides it.
  const trio = [
    { label: "asking worker", sessionId: "m1", state: "idle", target: "alpha", cwd: "/data" },
    { label: "worker two", target: "alpha", cwd: "/data", sessionId: "w2", state: "idle" },
    { label: "worker", target: "alpha", cwd: "/data", sessionId: "w1", state: "idle", derivation: { owner: "w2", lifecycle: "persistent" } },
  ];
  const trioSnapshots = Object.fromEntries(trio.map((row) => [row.sessionId, snapshotOf(row.sessionId, "idle")]));
  {
    const global = await openMockWorkbench(browser, server.url, { sessions: trio, snapshots: trioSnapshots, storage: { "pi.ask.notify": "1" } });
    await global.context.addInitScript(FAKE_NOTIFICATION, "granted");
    await global.page.reload();
    const { page } = global;
    await selectSession(page, "m1");
    const base = await page.title();
    const rowMarks = () => page.locator("[data-session-id][data-asking='true']").evaluateAll((nodes) => nodes.map((node) => node.dataset.sessionId));
    await setFront(page, false);
    await page.waitForTimeout(100);
    assert.equal(await page.title(), base, "nothing waits: no mark even in the background");
    assert.deepEqual(await rowMarks(), []);

    await push(page, asking("w1", true));
    await page.waitForFunction(() => window.__notes.length === 1);
    assert.equal(await markedTitle(page, base), true, "another session waits: the background title is marked");
    const markedOne = await page.title();
    assert.deepEqual(await rowMarks(), ["w1"]);
    assert.deepEqual(await page.evaluate(() => [window.__notes[0].tag, window.__notes[0].title]), ["prk-ask:w1", "worker"]);

    // Hidden rows still show: a folded parent row and a folded group carry the mark for what is inside.
    const toggle = page.locator('[data-session-id="w2"] .management-tree-toggle');
    await toggle.click();
    await page.locator('[data-session-id="w1"]').waitFor({ state: "detached" });
    assert.equal(await page.locator('[data-session-id="w2"] [data-ask-mark="below"]').count(), 1, "a folded parent shows that a child waits");
    await toggle.click();
    const header = page.locator('[data-group="alpha"] .management-group-header');
    assert.equal(await header.getAttribute("data-asking"), null, "an open group shows its rows instead");
    await header.click();
    assert.equal(await header.getAttribute("aria-expanded"), "false");
    assert.equal(await header.getAttribute("data-asking"), "true", "a folded group shows that a session in it waits");
    await header.click();

    await push(page, asking("w2", true));
    await page.waitForFunction(() => window.__notes.length === 2);
    assert.deepEqual((await rowMarks()).sort(), ["w1", "w2"]);
    assert.equal(await page.title(), markedOne, "one mark however many sessions wait");

    // The notification of a session selects it.
    await page.evaluate(() => window.__clickNote(0));
    await page.locator('[data-session-id="w1"] .management-session-select[aria-current="true"]').waitFor();
    await page.locator("#composer").waitFor();
    await setFront(page, true);
    assert.equal(await page.title(), base, "back in front: the title is restored");
    assert.deepEqual(await page.evaluate(() => window.__notes.map((note) => note.closed)), [true, true], "returning closes the notifications");

    await push(page, asking("w1", false));
    assert.deepEqual(await rowMarks(), ["w2"]);
    await setFront(page, false);
    assert.equal(await markedTitle(page, base), true, "one still waits: away again, marked again");
    await push(page, asking("w2", false));
    assert.deepEqual(await rowMarks(), []);
    assert.equal(await page.title(), base, "nothing waits any more: the title is restored");
    assert.equal(await page.evaluate(() => window.__notes.at(-1).closed), true);
    assert.deepEqual(global.problems, [], "page errors");
    await global.context.close();
    console.log("PASS ask reminder: any session, row / folded group marks, notification click selects it");
  }

  // The phone drawer shows the same mark, from the list snapshot alone.
  {
    const phone = await openMockWorkbench(browser, server.url, { sessions: trio.map((row) => row.sessionId === "w1" ? { ...row, asking: true } : row), snapshots: trioSnapshots, mobile: true, viewport: { width: 390, height: 844 } });
    await phone.page.locator("#open-sidebar").click();
    await phone.page.locator('[data-session-id="w1"][data-asking="true"] [data-ask-mark]').waitFor();
    assert.equal(await phone.page.locator('[data-session-id="m1"] [data-ask-mark]').count(), 0);
    assert.deepEqual(phone.problems, [], "page errors");
    await phone.context.close();
    console.log("PASS ask reminder: phone drawer row mark");
  }

  // Where the browser cannot notify (no secure context) the switch is disabled and says why.
  answered = false;
  const plain = await openMockWorkbench(browser, server.url, { sessions, snapshots, routes });
  await plain.context.addInitScript(() => { Object.defineProperty(window, "isSecureContext", { value: false }); });
  await plain.page.reload();
  await selectSession(plain.page, "m1");
  await plain.page.locator("#open-settings").click();
  assert.equal(await plain.page.locator("#setting-ask-notify").isDisabled(), true);
  await plain.page.locator("#ask-notify-note").waitFor();
  assert.deepEqual(plain.problems, [], "page errors");
  await plain.context.close();
  console.log("PASS ask reminder: notification switch disabled without a secure context");
} finally {
  await browser.close();
  await server.close();
}
