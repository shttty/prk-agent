// Plugin widgets in the tray (check:full): a widget the native renderer table knows (web/chat/plugin-renderers.js) is
// drawn natively when its plain-text lines parse; every other case shows the plugin's own widget content. The todo
// plugin is the first entry: its widget text (ANSI styled, as the host sends it) becomes the todo float. The API is mocked
// at the browser; the real web/ is served by Vite.
// Nothing here locates by UI copy: ids, data-* and classes only.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { assertUniqueIds } from "../fixtures/workspace-mock/assert-unique-ids.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { snapshotOf } from "../fixtures/workspace-mock/session-snapshots.mjs";

const TODO_WIDGET = "prk-todolist.todo";
const LINES = ["\x1b[1mTodo\x1b[0m \x1b[2m3/6\x1b[0m", "\x1b[2m✓ 2 completed\x1b[0m", "\x1b[36m\x1b[1m▸ chart  · w1\x1b[0m", "\x1b[33m! check\x1b[0m", "\x1b[33m  missing data\x1b[0m", "\x1b[90m○ write\x1b[0m", "\x1b[2m✕ export\x1b[0m"];
const widget = (key, ...lines) => ({ key, placement: "aboveEditor", node: { id: `widget-${key}`, kind: "text", lines } });

// One session per case: its render's widgets.
const CASES = {
  native: { widgets: [widget(TODO_WIDGET, ...LINES)] },
  unreadable: { widgets: [widget(TODO_WIDGET, "Todo (2/6)")] },
  unknown: { widgets: [widget("someone.else", ...LINES)] },
  cleared: { widgets: [] },
};
const names = Object.keys(CASES);
const sessions = names.map((name, index) => ({ label: name, sessionId: name, state: "idle", target: "alpha", cwd: "/data", index }));
const extensionUi = { revision: 1, autocomplete: false, status: [], notifications: [], working: { visible: false }, editor: { text: "", revision: 0 }, widgets: [] };
const snapshots = Object.fromEntries(sessions.map((worker) => [worker.sessionId, { ...snapshotOf(worker.sessionId, "idle"), extensionUi }]));
const routes = Object.fromEntries(names.map((name) => [`/api/sessions/${name}/native`, (body) => (body.action === "extension-ui"
  ? { requestId: body.requestId, action: body.action, status: "completed", message: "ok", data: { streamId: snapshots[name].streamId, revision: 2, status: [], notifications: [], prompts: [], tools: {}, toolErrors: {}, rendererErrors: [], messages: {}, entries: [], ...CASES[name] } }
  : { version: 1, commands: [], actions: [] })]));

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
const own = (page, key) => page.locator(`.pi-tray > .extension-ui-widget[data-widget-key="${key}"]`);
try {
  for (const phone of [false, true]) {
    const label = phone ? "phone" : "desktop";
    const { context, page, problems } = await openMockWorkbench(browser, server.url, { sessions, snapshots, routes, ...(phone ? { viewport: { width: 390, height: 844 }, mobile: true } : {}) });
    const open = async (name) => {
      if (phone) await page.locator("#open-sidebar").click();
      await selectSession(page, name);
      await page.locator('.pi-chat-fade[data-fading]').waitFor({ state: "detached" });
      // The tray has rendered once the render response's revision is applied.
      await page.locator('.pi-tray[data-extension-ui-revision]').waitFor({ state: "attached" });
      await page.waitForTimeout(300);
    };

    // A known widget whose text parses: the todo float replaces the plugin's lines.
    await open("native");
    const dock = page.locator(".pi-tray > #todo-dock");
    await dock.waitFor();
    assert.equal(await own(page, TODO_WIDGET).count(), 0, `${label}: the plugin's own lines are replaced, not shown twice`);
    assert.deepEqual(await dock.evaluate((node) => [node.dataset.done, node.dataset.count]), ["3", "6"]);
    const toggle = page.locator("#todo-toggle");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    const rows = await page.locator("#todo-list > li").evaluateAll((nodes) => nodes.map((node) => [node.dataset.kind, node.dataset.status ?? null, node.getAttribute("aria-current"), node.querySelector(".pi-todo-owner") !== null, node.querySelector(".pi-todo-reason") !== null]));
    assert.deepEqual(rows, [
      ["fold", null, null, false, false], ["task", "in_progress", "step", true, false], ["task", "blocked", null, false, true], ["task", "pending", null, false, false], ["task", "cancelled", null, false, false],
    ], `${label}: fold row, the item in progress current with its owner, the blocked reason shown`);
    assert.equal(await page.locator("#todo-list > li[data-kind='fold']").getAttribute("data-count"), "2");
    await assertUniqueIds(page, `${label} native`);
    // A todo change: the plugin redraws its widget (an extension_ui event), the next render brings the new lines.
    const before = CASES.native.widgets;
    CASES.native.widgets = [widget(TODO_WIDGET, ...LINES.map((line) => line.replace("3/6", "4/6").replace("▸ chart", "✓ chart")))];
    await page.evaluate(() => {
      const source = window.__eventSources.findLast((candidate) => candidate.url.endsWith("/sessions/native/events"));
      source.dispatchEvent(new MessageEvent("host", { data: JSON.stringify({ type: "extension_ui", streamId: "mock-native", sessionId: "native", sequence: 2, details: { extensionUi: { revision: 2, autocomplete: false, status: [], notifications: [], working: { visible: false }, editor: { text: "", revision: 0 }, widgets: [] } } }) }));
    });
    await page.waitForFunction(() => document.querySelector("#todo-dock")?.dataset.done === "4");
    CASES.native.widgets = before;

    // Everything else falls back to the plugin's own widget content, in a tray card.
    for (const [name, key, why] of [["unreadable", TODO_WIDGET, "text the parser rejects"], ["unknown", "someone.else", "no renderer for the widget"]]) {
      await open(name);
      await own(page, key).waitFor();
      assert.equal(await own(page, key).locator(".extension-ui-text").count(), 1, `${label} ${name}: the plugin's own lines are drawn`);
      assert.equal(await page.locator("#todo-dock").count(), 0, `${label} ${name}: ${why} → the plugin's own content, no todo float`);
    }
    // The plugin cleared its widget (empty list): nothing is drawn.
    await open("cleared");
    assert.equal(await page.locator("#todo-dock").count(), 0, `${label}: no widget, no float`);
    assert.equal(await page.locator(".pi-tray > .extension-ui-widget").count(), 0);
    assert.deepEqual(problems, [], `${label}: page errors`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log("PASS plugin widgets: native renderer from the widget text, fallback to the plugin's own widget otherwise (desktop and phone)");
