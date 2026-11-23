// Real Chromium + Vite, mocked API: a provider with more rows than the settings window is tall scrolls inside the right
// block (the window itself does not), so its last row can be reached and used. The same component serves the session
// window (tools / skills), the global settings pages and the instance settings.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { snapshotOf, SESSIONS } from "../fixtures/workspace-mock/session-snapshots.mjs";

const ROWS = 40;
const group = (kind, id, name) => ({ id, name, kind, enabled: true, available: true });
const entry = (kind, group, index) => ({ id: `${kind}:${group}:${index}`, name: `${kind}_${index}`, kind, group, groupLabel: group, enabled: true, groupEnabled: true, description: "d" });
const catalogOf = () => ({
  groups: [group("tool", "group:tools:library", "Saved tools"), group("tool", "group:tools:kernel", "kernel"), group("skill", "group:skills:global", "全局")],
  entries: [
    ...Array.from({ length: ROWS }, (_, index) => entry("tool", "group:tools:library", index)),
    ...Array.from({ length: 3 }, (_, index) => entry("tool", "group:tools:kernel", index)),
    ...Array.from({ length: ROWS }, (_, index) => entry("skill", "group:skills:global", index)),
  ],
});
const catalog = catalogOf();
const settings = { catalog, defaults: {}, config: {} };
const routes = {
  "/api/capabilities": () => settings,
  "/api/tools/list": () => ({ tools: [] }),
  "/api/skills/list": () => ({ skills: [] }),
  "/api/sessions/w1/native": (body) => (body.action === "capabilities"
    ? { requestId: body.requestId, action: "capabilities", status: "completed", message: "ok", data: catalog }
    : { commands: [], actions: [], target: { identity: "w1", sessionId: "w1", state: "idle" }, resources: [] }),
};
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();

/** The last row of the shown provider scrolls into the visible part of the right block and receives pointer events. */
async function reachLastRow(page, label, { listId, detail: detailSelector }) {
  const detail = page.locator(detailSelector);
  await detail.waitFor();
  const before = await detail.evaluate((node) => ({ client: node.clientHeight, scroll: node.scrollHeight }));
  assert(before.scroll > before.client, `${label}: more rows than room (${before.scroll} <= ${before.client})`);
  const frame = await page.evaluate(() => { const content = document.querySelector(".mantine-Modal-content:not([style*=\"display: none\"])"); return { viewport: innerHeight, content: content.getBoundingClientRect().height }; });
  assert(frame.content <= frame.viewport + 1, `${label}: the window fits the viewport`);
  const last = page.locator(`#${listId} .capability-row`).last();
  await last.scrollIntoViewIfNeeded();
  const inside = await last.evaluate((row) => {
    const rect = row.getBoundingClientRect();
    const box = row.closest(".capability-detail").getBoundingClientRect();
    return rect.bottom <= box.bottom + 1 && rect.top >= box.top;
  });
  assert(inside, `${label}: the last row is inside the right block after scrolling`);
  assert((await detail.evaluate((node) => node.scrollTop)) > 0, `${label}: the right block itself scrolled`);
  const hit = await last.evaluate((row) => { const rect = row.getBoundingClientRect(); return row.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)); });
  assert(hit, `${label}: the last row receives pointer events`);
}

/** Pick the long provider (a phone opens its sheet) and check it. */
async function checkProvider(page, label, mobile, kind) {
  const provider = page.locator(`.capability-provider[data-provider="${kind === "tools" ? "group:tools:library" : "group:skills:global"}"]`);
  await provider.waitFor();
  await provider.click();
  if (mobile) await page.locator("#capability-sheet[aria-hidden=false]").waitFor();
  await reachLastRow(page, label, { listId: `${kind}-library-list`, detail: mobile ? "#capability-sheet .capability-detail" : ".capability-detail-host > .pi-fade-live > .capability-detail" });
  // The phone sheet covers the window's close button until it is dismissed.
  if (mobile) { await page.locator("#capability-sheet [data-action=close-provider]").click(); await page.locator("#capability-sheet[aria-hidden=true]").waitFor({ state: "attached" }); }
}

try {
  for (const [tag, scheme, viewport, mobile] of [["desktop", "light", { width: 1440, height: 800 }, false], ["phone", "dark", { width: 390, height: 700 }, true]]) {
    const h = await openMockWorkbench(browser, server.url, { sessions: SESSIONS.slice(0, 1), snapshots: { w1: snapshotOf("w1", "idle") }, routes, colorScheme: scheme, viewport, mobile, storage: { "pi-session-theme": scheme }, search: "#sessionId=w1" });
    const { page } = h;
    const openSidebar = async () => { if (mobile) await page.locator("#open-sidebar").click(); };
    try {
      await openSidebar();
      await selectSession(page, "w1");
      // 1. the session window: tools, then skills
      for (const [menuId, kind] of [["session-tools", "tools"], ["session-skills", "skills"]]) {
        await openSidebar();
        await page.locator('[data-session-id="w1"] [data-action="session-menu"]').click();
        await page.locator(`#${menuId}`).click();
        await checkProvider(page, `${tag} session ${kind}`, mobile, kind);
        await page.locator("#close-session-capabilities").click();
        await page.locator("#session-capabilities-dialog").waitFor({ state: "hidden" });
      }
      // 2. the global settings pages
      for (const kind of ["tools", "skills"]) {
        await openSidebar();
        await page.locator("#open-settings").click();
        await page.locator(`[data-settings-section="${kind}"]`).click();
        await checkProvider(page, `${tag} settings ${kind}`, mobile, kind);
        await page.locator("#close-settings").click();
        await page.locator("#settings-dialog").waitFor({ state: "hidden" });
      }
      // 3. an instance's settings
      for (const kind of ["tools", "skills"]) {
        await openSidebar();
        await page.locator('[data-action="instance-menu"]').first().click();
        await page.locator('[data-action="instance-settings"]').click();
        await page.locator(`[data-instance-tab="${kind}"]`).click();
        await checkProvider(page, `${tag} instance ${kind}`, mobile, kind);
        await page.locator("#close-instance-settings").click();
        await page.locator("#instance-settings-dialog").waitFor({ state: "hidden" });
      }
      assert.deepEqual(h.problems, [], `${tag}: no page errors`);
      console.log(`PASS capability scroll ${tag}: the last row of a long provider is reachable in the session, settings and instance windows (tools and skills)`);
    } finally { await h.context.close(); }
  }
} finally {
  await browser.close();
  await server.close();
}
