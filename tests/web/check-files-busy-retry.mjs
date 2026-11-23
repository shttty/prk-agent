// Real Chromium + Vite, mocked Gateway: while a session transition is running the files routes answer a transient
// BUSY. The panel (tree and editor tab) must wait for the next session state change, retry, and show the content —
// never park on the error. A BUSY that is not transient and a plain failure still show an error.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { createMockFs } from "../fixtures/workspace-mock/create-mock-fs.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { snapshotOf, SESSIONS } from "../fixtures/workspace-mock/session-snapshots.mjs";

const targets = [{ id: "alpha", label: "Alpha", local: false, sshCommand: "ssh -T alpha", python: "/usr/bin/python3", cwd: "/data" }];
const sessions = SESSIONS.slice(0, 1);
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();

/** The Gateway finished a transition: the workbench stream reports the worker in another state. */
const settle = (page, state) => page.evaluate(({ targets: t, sessions: w }) => {
  for (const source of window.__eventSources.filter((entry) => /\/sessions\/events$/.test(entry.url))) source.dispatchEvent(new MessageEvent("snapshot", { data: JSON.stringify({ targets: t, sessions: w, archive: [] }) }));
}, { targets, sessions: sessions.map((worker) => ({ ...worker, state })) });

try {
  for (const [tag, scheme, viewport] of [["desktop", "light", { width: 1440, height: 900 }], ["desktop-dark", "dark", { width: 1280, height: 800 }]]) {
    let mode = "busy";
    const seen = { busy: 0, ok: 0 };
    const h = await openMockWorkbench(browser, server.url, {
      sessions, snapshots: { w1: snapshotOf("w1", "idle") }, targets, fs: createMockFs({ "note.txt": "hello after settle\n", "other.txt": "x\n" }),
      colorScheme: scheme, viewport, mobile: viewport.width < 500, search: "#sessionId=w1",
      beforeGoto: (page) => page.route(/\/api\/sessions\/w1\/files\/\w+$/, (route) => {
        if (mode === "ok") { seen.ok++; return route.fallback(); }
        seen.busy++;
        const transient = mode === "busy";
        return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "BUSY", message: "Session is changing.", ...(transient ? { details: { transient: true } } : {}) }) });
      }),
    });
    const { page } = h;
    try {
      await page.locator("#toggle-workspace").click();
      await page.locator("#toggle-tree").click();
      const panel = page.locator("#files-panel");
      await panel.waitFor();
      while (seen.busy === 0) await page.waitForTimeout(20);
      await page.waitForTimeout(150);
      assert.equal(await panel.locator("[role=alert]").count(), 0, `${tag}: a transient BUSY is waited out, not shown`);
      mode = "ok";
      await settle(page, "running");
      const row = page.locator('#file-tree li[data-path="note.txt"] .pi-files-row');
      await row.waitFor({ timeout: 5000 });
      assert.equal(await panel.locator("[role=alert]").count(), 0, `${tag}: tree recovered by itself`);

      // The editor tab: its read meets a transition too, and recovers after the next state change.
      mode = "busy";
      const busyBefore = seen.busy;
      await row.click();
      while (seen.busy === busyBefore) await page.waitForTimeout(20);
      await page.waitForTimeout(150);
      assert.equal(await page.locator('.pi-file[data-path="note.txt"] [role=alert]').count(), 0, `${tag}: editor does not park on the transient BUSY`);
      mode = "ok";
      await settle(page, "idle");
      await page.locator('.pi-file[data-path="note.txt"] .cm-content').waitFor({ timeout: 5000 });
      assert.equal(await page.locator('.pi-file[data-path="note.txt"] .cm-content').textContent(), "hello after settle");

      // A BUSY without the transient mark is a real refusal: shown at once, not retried after a state change.
      mode = "final";
      const finalBefore = seen.busy;
      await page.locator("#toggle-tree").click(); // the popover closed when note.txt opened
      await page.locator('#file-tree li[data-path="other.txt"] .pi-files-row').click();
      await page.locator('.pi-file[data-path="other.txt"] [role=alert]').waitFor({ timeout: 5000 });
      await settle(page, "running");
      await page.waitForTimeout(200);
      assert.equal(seen.busy, finalBefore + 1, `${tag}: a non-transient BUSY is not retried`);
      assert.deepEqual(h.problems, [], `${tag}: no page errors`);
      console.log(`PASS files busy retry ${tag}: tree and editor recover after the session settles (busy replies ${seen.busy})`);
    } finally { await h.context.close(); }
  }
} finally {
  await browser.close();
  await server.close();
}
