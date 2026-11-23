// Session banner stack and plugin toasts (check:full, mock workbench): the chip folds the stack to a small bar without
// moving the conversation, the actions inside come back on unfolding, the fold is per session and memory only, and a
// toast always starts below the stack (folded or not) and where it did before when there is no stack. Nothing here
// locates by UI copy; screenshots go to PI_TEST_WEB_EVIDENCE when it is set.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { SNAPSHOTS, SESSIONS } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";

const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) mkdirSync(evidence, { recursive: true });

const sessions = SESSIONS.slice(0, 2).map((worker) => ({ ...worker, requiresReload: true }));
const toast = { id: "toast-1", type: "error", message: "plugin failed", sessionId: SNAPSHOTS.w1.sessionId, createdAt: new Date(Date.now() + 3_600_000).toISOString() };
const extensionUi = { revision: 1, autocomplete: false, status: [], notifications: [toast], working: { visible: false }, editor: { text: "", revision: 0 }, widgets: [] };
const messages = Array.from({ length: 6 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: [{ type: "text", text: `BANNER_SCENE_${index}` }], timestamp: 1000 + index, ...(index % 2 ? { stopReason: "stop" } : {}) }));
const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, messages, messageEntryIds: messages.map((_, index) => `e${index}`), extensionUi } };

// A catalog answer per worker keeps the "catalog unavailable" banner out: the reload notice is the only one.
const catalog = { version: 1, commands: [], actions: [], inputPrefixes: [{ prefix: "/", enabled: true }], resources: [], attachments: { enabled: true, imageMimeTypes: [] }, references: { targetFile: { enabled: true, candidates: [] } } };
const routes = { "/api/sessions/w1/native": () => catalog, "/api/sessions/w2/native": () => catalog };
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
const box = (page, selector) => page.locator(selector).first().evaluate((node) => { const { x, y, width, height, bottom } = node.getBoundingClientRect(); return { x, y, width, height, bottom }; });
/** What must not move when the stack folds: the thread, the composer and the column itself. */
const conversation = async (page) => ({ thread: await box(page, ".pi-thread"), composer: await box(page, "#composer"), column: await box(page, ".pi-chatcol") });
const shot = async (page, name) => { if (evidence) { await page.waitForTimeout(450); await page.screenshot({ path: join(evidence, `${name}.png`) }); } };

try {
  for (const [tag, scheme, viewport, mobile] of [["desktop-light", "light", { width: 1440, height: 900 }, false], ["desktop-dark", "dark", { width: 1440, height: 900 }, false], ["phone-dark", "dark", { width: 390, height: 844 }, true]]) {
    const h = await openMockWorkbench(browser, server.url, { sessions, snapshots, routes, colorScheme: scheme, viewport, mobile, storage: { "pi-session-theme": scheme } });
    const { page } = h;
    const select = async (name) => { if (mobile) await page.locator("#open-sidebar").click(); await selectSession(page, name); };
    try {
      await select("w1");
      const stack = page.locator("#session-banners");
      await stack.waitFor();
      const toastBox = page.locator('[data-toast-id="toast-1"]');
      await toastBox.waitFor();
      assert.equal(await stack.getAttribute("data-collapsed"), "false", `${tag}: banners start unfolded`);
      await page.locator("#reload-capabilities").waitFor({ state: "visible" });

      const open = { stack: await box(page, "#session-banners"), toast: await box(page, '[data-toast-id="toast-1"]'), ...(await conversation(page)) };
      assert.ok(open.toast.y >= open.stack.bottom, `${tag}: the toast starts below the banner stack (${open.toast.y} >= ${open.stack.bottom})`);
      await shot(page, `banners-${tag}-open`);

      const banners = await page.locator("#session-banners > .pi-banner").count();
      assert.ok(banners >= 1, `${tag}: at least the reload banner is up`);
      await page.locator("#toggle-banners").click();
      await page.locator('#session-banners[data-collapsed="true"]').waitFor();
      assert.equal(await page.locator("#reload-capabilities").count(), 0, `${tag}: folded banners hide their actions`);
      assert.equal(await stack.getAttribute("data-count"), String(banners), `${tag}: the chip counts the banners`);
      const folded = { stack: await box(page, "#session-banners"), toast: await box(page, '[data-toast-id="toast-1"]') };
      assert.ok(folded.stack.height < open.stack.height, `${tag}: the folded stack takes less room (${folded.stack.height} < ${open.stack.height})`);
      await page.waitForFunction((bottom) => document.querySelector('[data-toast-id="toast-1"]').getBoundingClientRect().top >= document.querySelector("#session-banners").getBoundingClientRect().bottom && document.querySelector('[data-toast-id="toast-1"]').getBoundingClientRect().top < bottom, open.toast.y);
      assert.deepEqual(await conversation(page), { thread: open.thread, composer: open.composer, column: open.column }, `${tag}: folding moves nothing in the conversation`);
      await shot(page, `banners-${tag}-folded`);

      await page.locator("#toggle-banners").click();
      await page.locator("#reload-capabilities").waitFor({ state: "visible" });
      await page.locator("#toggle-banners").click();
      await page.locator('#session-banners[data-collapsed="true"]').waitFor();

      // The fold belongs to its session: another session starts unfolded, and coming back does not restore it.
      await select("w2");
      await page.locator('#session-banners[data-collapsed="false"]').waitFor();
      await select("w1");
      await page.locator('#session-banners[data-collapsed="false"]').waitFor();
      await page.locator("#reload-capabilities").waitFor({ state: "visible" });
      assert.deepEqual(h.problems, [], `${tag}: no page errors`);
      console.log(`PASS session banners ${tag}`);
    } finally { await h.context.close(); }
  }

  // A toast with no banner stack sits where it always did.
  const calm = await openMockWorkbench(browser, server.url, { sessions: sessions.map((worker) => ({ ...worker, requiresReload: false })), snapshots, routes });
  try {
    await selectSession(calm.page, "w1");
    const toastNode = calm.page.locator('[data-toast-id="toast-1"]');
    await toastNode.waitFor();
    assert.equal(await calm.page.locator("#session-banners").count(), 0, "no stack without banners");
    const top = await calm.page.evaluate(() => document.querySelector(".pi-toasts").getBoundingClientRect().top - document.querySelector(".pi-thread").getBoundingClientRect().top);
    assert.equal(top, 10, "toasts keep their original place without a stack");
    console.log("PASS toast place without banners");
  } finally { await calm.context.close(); }
} finally {
  await browser.close();
  await server.close();
}
