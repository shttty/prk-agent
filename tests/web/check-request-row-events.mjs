// Collection mutations (rename, archive, unarchive, purge) update the page from per-row collection events alone:
// no workbench reload after the POST or after the event, and the rows still end up correct.
import assert from "node:assert/strict";
import { withRequestWorkbench, openSession } from "./request-trim/launch-request-workbench.mjs";

await withRequestWorkbench(async ({ host, ui, page, requests, settle, createSession, errors }) => {
  const sessionId = await createSession("Row events");
  await openSession(page, ui.url, sessionId);
  const row = page.locator(`[data-session-id="${sessionId}"]`).first();
  const archive = page.locator("#settings-archive");
  const group = archive.locator(`[data-archive-group="${sessionId}"]`);
  const counts = {};
  const measure = async (name, act) => {
    const mark = requests.mark();
    await act();
    await settle();
    counts[name] = requests.since(mark, "GET", /^\/api\/(workbench|session-control)$/);
  };

  await measure("rename", async () => {
    await row.locator('[data-action="session-menu"]').click();
    await page.locator("#rename-session").click();
    await page.locator('#management-dialog[data-kind="rename"] input').fill("Renamed row");
    await page.locator('#management-dialog[data-kind="rename"] button[type="submit"]').click();
    await page.waitForFunction((id) => document.querySelector(`[data-session-id="${id}"]`)?.textContent.includes("Renamed row"), sessionId);
  });
  await measure("archive", async () => {
    await row.locator('[data-action="session-menu"]').click();
    await page.locator("#archive-session").click();
    await page.locator('#management-dialog[data-kind="archive"] #confirm-archive').click();
    await row.waitFor({ state: "detached" });
  });
  await page.locator("#open-settings").click();
  await page.locator("#open-archive").click();
  await group.waitFor();
  await measure("unarchive", async () => {
    await group.locator('[data-action="unarchive"]').click();
    await archive.locator('[data-state="empty"]').waitFor();
    await row.waitFor({ state: "attached" });
  });
  await host.archiveSession(sessionId, { confirm: true });
  await group.waitFor();
  await measure("purge", async () => {
    await group.locator('[data-action="purge-archive"]').click();
    await archive.locator('[data-action="confirm-purge-archive"]').click();
    await archive.locator('[data-state="empty"]').waitFor();
  });
  console.log(`REQTRIM row-events ${JSON.stringify(counts)}`);
  assert.deepEqual(counts, { rename: 0, archive: 0, unarchive: 0, purge: 0 });
  assert.equal(await row.count(), 0, "purged session stays gone");
  assert.deepEqual(errors, []);
  console.log("PASS request trim: collection mutations apply per-row events without workbench reloads");
});
