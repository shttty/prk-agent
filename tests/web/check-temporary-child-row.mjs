// Every derived lifecycle keeps the plain structural child badge in the sidebar.
// Only temporary sessions get a lifecycle label in archive previews and archived groups.
import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { SNAPSHOTS, SESSIONS, snapshotOf } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";

const child = (sessionId, lifecycle) => ({ label: sessionId, sessionId, state: "idle", target: "alpha", cwd: "/data", derivation: { owner: "w1", createdBy: "w1", phase: "working", lifecycle } });
const sessions = [SESSIONS[0], child("t1", "temporary"), child("k3", "persistent"), { ...child("u1", "user"), derivation: { owner: null, lifecycle: "user" } }, ...SESSIONS.slice(1)];
const snapshots = { ...SNAPSHOTS, t1: snapshotOf("t1", "idle"), k3: snapshotOf("k3", "idle"), u1: snapshotOf("u1", "idle") };
const archived = sessions.slice(0, 4).map((worker) => ({ ...worker, owner: worker.derivation?.owner ?? null, lifecycle: worker.derivation?.lifecycle }));
const archive = [
  { group: "w1", label: "Lifecycle archive", at: "2026-11-03T00:00:00.000Z", sessions: archived.slice(0, 3) },
  { group: "u1", label: "Independent lifecycle archive", at: "2026-11-03T00:00:00.000Z", sessions: archived.slice(3) },
];
const routes = Object.fromEntries(archive.map(({ group, sessions }) => [`/api/sessions/${group}/archive-preview`, () => ({ root: group, sessions, retained: [] })]));
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  const h = await openMockWorkbench(browser, server.url, { sessions, snapshots, archive, routes });
  try {
    const badge = (name) => h.page.locator(`[data-session-id="${name}"] .management-session-capability`);
    await badge("t1").waitFor();
    assert.equal(await badge("t1").getAttribute("data-kind"), "child");
    assert.equal(await badge("k3").getAttribute("data-kind"), "child");
    assert.equal(await badge("u1").getAttribute("data-kind"), "child");
    assert.equal(await h.page.locator('[data-session-id="w1"] .management-session-capability').count(), 0, "a top-level session has no child badge");
    for (const name of ["w1", "u1"]) {
      await h.page.locator(`[data-session-id="${name}"] [data-action="session-menu"]`).click();
      await h.page.locator("#archive-session").click();
      const preview = h.page.locator('#management-dialog[data-kind="archive"]');
      await preview.locator(`[data-affected="${name}"]`).waitFor();
      if (name === "w1") await preview.locator('[data-affected="t1"] [data-lifecycle="temporary"]').waitFor();
      assert.equal(await preview.locator("[data-lifecycle]").count(), name === "w1" ? 1 : 0);
      await preview.locator('[data-action="cancel"]').click();
    }
    await h.page.locator("#open-settings").click();
    await h.page.locator("#open-archive").click();
    const archiveView = h.page.locator("#settings-archive");
    await archiveView.locator('[data-archived="t1"] [data-lifecycle="temporary"]').waitFor();
    for (const name of ["w1", "k3", "u1"]) {
      await archiveView.locator(`[data-archived="${name}"]`).waitFor();
      assert.equal(await archiveView.locator(`[data-archived="${name}"] [data-lifecycle]`).count(), 0);
    }
    assert.deepEqual(h.problems, [], "no page errors");
    console.log("PASS session lifecycle labels and structural child badges");
  } finally { await h.context.close(); }
} finally {
  await browser.close();
  await server.close();
}
