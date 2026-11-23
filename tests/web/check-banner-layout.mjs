// Session banner layout (mock workbench): the stack floats over the top of the conversation column and takes the
// reading column's content width, whatever the window, the sidebars or the monitor panel do. In every state of the
// matrix (window 1440 / 1100 / 820 and phone 390 / 320; session sidebar open / folded; workspace open / closed;
// monitor panel open / closed) the stack's edges are the messages' content edges (1px), the fold chip is the stack's
// top-right corner, every action sits on a text line at the right of the text, and the stack starts at most 12px
// under the top of the thread (the thread starts under the heading strip). Nothing here locates by UI copy.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { SNAPSHOTS, SESSIONS } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";

const sessions = SESSIONS.slice(0, 1).map((worker) => ({ ...worker, requiresReload: true }));
const messages = Array.from({ length: 6 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: [{ type: "text", text: `BANNER_LAYOUT_${index}` }], timestamp: 1000 + index, ...(index % 2 ? { stopReason: "stop" } : {}) }));
const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, messages, messageEntryIds: messages.map((_, index) => `e${index}`) } };
// A catalog answer keeps the "catalog unavailable" banner out: the stack holds the connection banner and the reload notice.
const catalog = { version: 1, commands: [], actions: [], inputPrefixes: [{ prefix: "/", enabled: true }], resources: [], attachments: { enabled: true, imageMimeTypes: [] }, references: { targetFile: { enabled: true, candidates: [] } } };
const routes = { "/api/sessions/w1/native": () => catalog };
const LONG_REASON = Array.from({ length: 30 }, (_, index) => `reason-part-${index}`).join(" ");

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();

/** Geometry of everything the layout rules relate, read in one evaluation so nothing moves between reads. */
const measure = (page) => page.evaluate(() => {
  const rect = (node) => { const { left, right, top, bottom } = node.getBoundingClientRect(); return { left, right, top, bottom }; };
  const messagesNode = document.querySelector(".pi-messages");
  const padding = messagesNode ? getComputedStyle(messagesNode) : null;
  const message = messagesNode ? rect(messagesNode) : null;
  const heading = document.querySelector(".pi-session-heading");
  const lines = (node) => {
    const found = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      for (const line of range.getClientRects()) found.push({ top: line.top, bottom: line.bottom, right: line.right });
    }
    return found;
  };
  return {
    stack: rect(document.querySelector("#session-banners")),
    toggle: rect(document.querySelector("#toggle-banners")),
    column: rect(document.querySelector(".pi-chatcol")),
    thread: rect(document.querySelector(".pi-thread")),
    content: message ? { left: message.left + parseFloat(padding.paddingLeft), right: message.right - parseFloat(padding.paddingRight) } : null,
    heading: heading ? rect(heading) : null,
    room: parseFloat(getComputedStyle(document.querySelector(".pi-banner-lane")).paddingRight),
    mode: document.querySelector(".pi-chatcol").dataset.monitor ?? null,
    rows: [...document.querySelectorAll("#session-banners .pi-banner-row")].map((row) => ({
      lines: lines(row.querySelector(".pi-banner-text")),
      actions: [...row.closest(".pi-banner").querySelectorAll(".pi-banner-actions button, .mantine-Alert-closeButton")].map((button) => ({ ...rect(button), center: (button.getBoundingClientRect().top + button.getBoundingClientRect().bottom) / 2 })),
    })),
  };
});

async function settled(page) {
  let last = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const now = JSON.stringify(await measure(page));
    if (now === last) return JSON.parse(now);
    last = now;
    await page.waitForTimeout(100);
  }
  throw new Error("the layout never settled");
}

function assertBanner(m, label) {
  assert.ok(m.content, `${label}: the conversation has its messages`);
  assert.ok(Math.abs(m.stack.left - m.content.left) <= 1, `${label}: stack left ${m.stack.left} is the messages' ${m.content.left}`);
  assert.ok(Math.abs(m.stack.right - m.content.right) <= 1, `${label}: stack right ${m.stack.right} is the messages' ${m.content.right}`);
  assert.ok(Math.abs(m.toggle.right - m.stack.right) <= 1, `${label}: chip right ${m.toggle.right} is the stack's ${m.stack.right}`);
  assert.ok(Math.abs(m.toggle.top - m.stack.top) <= 1, `${label}: chip top ${m.toggle.top} is the stack's ${m.stack.top}`);
  assert.ok(m.stack.left >= m.column.left && m.stack.right <= m.column.right, `${label}: the stack is inside the chat column`);
  const gap = m.stack.top - m.thread.top;
  assert.ok(gap >= 0 && gap <= 12, `${label}: the stack starts ${gap}px under the thread top`);
  if (m.heading) assert.ok(m.stack.top >= m.heading.bottom - 1, `${label}: the stack is under the heading row`);
  assert.ok(m.rows.length >= 2, `${label}: the connection and reload banners are both up`);
  for (const [index, row] of m.rows.entries()) {
    assert.ok(row.lines.length >= 1 && row.actions.length >= 1, `${label}: banner ${index} has text and an action`);
    const textRight = Math.max(...row.lines.map((line) => line.right));
    for (const action of row.actions) {
      assert.ok(row.lines.some((line) => action.center >= line.top - 1 && action.center <= line.bottom + 1), `${label}: banner ${index} action centre ${action.center} is on a text line`);
      assert.ok(action.left >= textRight - 1, `${label}: banner ${index} action is at the right of its text`);
      assert.ok(action.right <= m.stack.right + 1, `${label}: banner ${index} action stays inside the stack`);
    }
  }
}

async function open(viewport, mobile) {
  const h = await openMockWorkbench(browser, server.url, { sessions, snapshots, routes, viewport, mobile });
  if (mobile) await h.page.locator("#open-sidebar").click();
  await selectSession(h.page, "w1");
  await h.page.locator("#reload-capabilities").waitFor({ state: "visible" });
  // The event stream gives up: the connection banner with its retry button joins the reload notice.
  await h.page.evaluate(() => { const source = window.__eventSources.findLast((item) => item.url.includes("/sessions/w1/events")); source.readyState = 2; source.onerror(new Event("error")); });
  await h.page.locator("#retry-connection").waitFor({ state: "visible" });
  return h;
}

/** Click a control only when its state differs from the wanted one. */
async function setToggle(page, selector, attribute, wanted) {
  if ((await page.locator(selector).getAttribute(attribute)) !== String(wanted)) await page.locator(selector).click();
  await page.waitForFunction(([target, name, value]) => document.querySelector(target)?.getAttribute(name) === value, [selector, attribute, String(wanted)]);
}

let reserved = 0;
try {
  for (const width of [1440, 1100, 820]) {
    const h = await open({ width, height: 900 }, false);
    const { page } = h;
    try {
      for (const sidebar of ["open", "folded"]) for (const workspace of [false, true]) for (const monitor of [false, true]) {
        const label = `${width} sidebar ${sidebar} workspace ${workspace ? "open" : "closed"} monitor ${monitor ? "open" : "closed"}`;
        const shown = await page.locator("#toggle-session-sidebar").isVisible();
        if ((sidebar === "folded") === shown) await page.locator(shown ? "#toggle-session-sidebar" : "#expand-session-sidebar").click();
        await setToggle(page, "#toggle-workspace", "aria-expanded", workspace);
        await setToggle(page, "#toggle-monitor", "aria-pressed", monitor);
        const m = await settled(page);
        assertBanner(m, label);
        if (m.room > 0) reserved += 1;
        if (monitor && m.mode === "panel") assert.ok(m.stack.right <= m.column.right - 304, `${label}: beside the panel the stack stays clear of it`);
      }
      assert.deepEqual(h.problems, [], `${width}: no page errors`);
      console.log(`PASS banner layout ${width}: 8 states`);
    } finally { await h.context.close(); }
  }
  assert.ok(reserved > 0, "some state has the monitor panel taking room from the reading column, so the stack followed it");

  for (const [width, label] of [[390, "phone"], [320, "narrow phone"]]) {
    const h = await open({ width, height: 844 }, true);
    try {
      for (const monitor of [false, true]) {
        await setToggle(h.page, "#toggle-monitor", "aria-pressed", monitor);
        assertBanner(await settled(h.page), `${label} monitor sheet ${monitor ? "open" : "closed"}`);
      }
      assert.deepEqual(h.problems, [], `${label}: no page errors`);
      console.log(`PASS banner layout ${label}`);
    } finally { await h.context.close(); }
  }

  // A refused session subscription: headline, long reason that wraps, retry and close stay on the right and on the text.
  for (const [width, mobile] of [[1440, false], [390, true]]) {
    const h = await openMockWorkbench(browser, server.url, { sessions, snapshots: { ...snapshots, w1: undefined }, routes, viewport: { width, height: 900 }, mobile });
    try {
      if (mobile) await h.page.locator("#open-sidebar").click();
      await h.page.locator('[data-session-id="w1"] .management-session-select').click();
      // The Gateway refuses before the first snapshot with a single `error` frame (WEB-50).
      await h.page.waitForFunction(() => window.__eventSources.some((item) => item.url.includes("/sessions/w1/events")));
      await h.page.evaluate((reason) => { const source = window.__eventSources.findLast((item) => item.url.includes("/sessions/w1/events")); source.onerror(new MessageEvent("error", { data: JSON.stringify({ error: reason, code: "FAILED" }) })); }, LONG_REASON);
      await h.page.locator("#connection-banner .mantine-Alert-closeButton").waitFor({ state: "visible" });
      await h.page.locator("#retry-connection").waitFor({ state: "visible" });
      const m = await h.page.evaluate(() => {
        const row = document.querySelector("#connection-banner .pi-banner-row");
        const text = row.querySelector(".pi-banner-text");
        const range = document.createRange();
        range.selectNodeContents(row.querySelector("#chat-error"));
        const lines = new Set([...range.getClientRects()].map((line) => Math.round(line.top)));
        const retry = document.querySelector("#retry-connection").getBoundingClientRect();
        const close = document.querySelector("#connection-banner .mantine-Alert-closeButton").getBoundingClientRect();
        const box = text.getBoundingClientRect();
        return { lines: lines.size, retry: { left: retry.left, center: (retry.top + retry.bottom) / 2 }, close: { left: close.left, center: (close.top + close.bottom) / 2 }, text: { right: box.right, top: box.top, bottom: box.bottom } };
      });
      assert.ok(m.lines > 1, `${width}: the long reason wraps (${m.lines} lines)`);
      assert.ok(m.retry.left >= m.text.right - 1 && m.close.left >= m.retry.left, `${width}: text, then retry, then close, left to right`);
      for (const center of [m.retry.center, m.close.center]) assert.ok(center >= m.text.top && center <= m.text.bottom, `${width}: the actions are centred on the wrapped text`);
      console.log(`PASS banner wrap ${width}`);
    } finally { await h.context.close(); }
  }
} finally {
  await browser.close();
  await server.close();
}
