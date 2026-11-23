// ── chrome: no top bar, collapsible session sidebar, one workspace icon, per-session availability ──
// ── workspace expand / collapse x saved state x session kind ──
import assert from "node:assert/strict";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";
import { layoutKey } from "../../../web/shell/layout/layout-store.js";

export async function checkDesktopAndPhoneChrome(ctx) {
await ctx.step("desktop chrome", async () => {
    const h = await ctx.open();
    const { page } = h;
    assert.equal(await page.locator("#topbar-title").textContent(), "worker", "title hook stays in the DOM");
    assert.equal(await page.locator('header .topbar-status[data-status="idle"]').count(), 1, "status hook stays in the DOM");
    assert.equal(await page.locator(".topbar").evaluate((node) => node.getBoundingClientRect().width <= 1), true, "the top bar takes no space");
    const chatTop = await page.locator(".pi-chat").evaluate((node) => node.getBoundingClientRect().top);
    assert.ok(chatTop < 60, `the chat column starts at the top (${chatTop})`);
    assert.equal(await page.locator("#toggle-theme, #theme-toggle").count(), 1);
    assert.equal(await page.locator(".management-sidebar-footer #theme-toggle").count(), 1, "theme switch lives in the sidebar footer");
    await page.locator("#toggle-session-sidebar").click();
    await page.locator("#expand-session-sidebar").waitFor();
    assert.equal(await page.locator(".desktop-sidebar").isVisible(), false);
    await assertUniqueIds(page, "sidebar collapsed");
    await page.reload();
    await page.locator("#expand-session-sidebar").waitFor();
    await page.locator("#expand-session-sidebar").click();
    assert.equal(await page.locator(".desktop-sidebar").isVisible(), true, "the sidebar comes back");
    assert.equal(await page.locator("#expand-session-sidebar").count(), 0);
    await ctx.finish(h, "desktop chrome");
  });

const STATES = {
    "fresh": async () => {},
    "saved, reloaded": async (page, session) => {
      await ctx.toggleWorkspace(page, true, "saved: expand");
      await ctx.openFile(page, "main.py");
      await page.reload(); await selectSession(page, session);
    },
    "used, reloaded": async (page, session) => {
      await ctx.toggleWorkspace(page, true, "used: expand");
      await ctx.openFile(page, "main.py");
      await page.locator("#toggle-tree").click(); // the popover closed itself when the file opened
      await ctx.openFile(page, "README.md");
      await page.locator("#new-terminal").click(); await page.locator('#desktop-stage .pi-tab[data-kind="terminal"]').waitFor();
      await ctx.toggleWorkspace(page, false, "used: collapse");
      await page.reload(); await selectSession(page, session);
    },
  };

let toggleFixture;

for (const [state, prepare] of Object.entries(STATES)) {
    for (const session of state === "fresh" ? ["w1", "c1"] : ["w1"]) {
      await ctx.step(`workspace toggle: ${state} / ${session}`, async () => {
        const h = session === "w1" && toggleFixture ? toggleFixture : await ctx.open({}, session);
        if (h === toggleFixture) await ctx.restart(h);
        if (session === "w1") toggleFixture = h;
        const { page } = h;
        if (session === "w1") await prepare(page, session);
        await assertUniqueIds(page, `${state}/${session}: load`);
        if (await ctx.stored(page, layoutKey("workspaceOpen")) === "true") await page.locator('#desktop-stage[data-open="true"]').waitFor();
        if (await ctx.stageOpen(page)) await ctx.toggleWorkspace(page, false, "close first");
        await ctx.toggleWorkspace(page, true, `${state}/${session}: expand`);
        await page.locator("#desktop-stage .pi-stage-grid").waitFor({ state: "attached" });
        assert.equal(await page.locator("#file-tree").isVisible() || await page.locator(".pi-stage-strip #toggle-tree").isVisible(), true, "the directory is open or available from the stage strip");
        if (session === "c1") {
          const recover = await page.locator("#topbar-recover").boundingBox();
          const collapse = await page.locator("#toggle-workspace").boundingBox();
          assert.ok(recover.x < collapse.x, "reconnect sits left of the collapse icon");
        }
        await ctx.toggleWorkspace(page, false, `${state}/${session}: collapse`);
        if (session === "c1") {
          const recover = await page.locator("#topbar-recover").boundingBox();
          const expand = await page.locator("#toggle-workspace").boundingBox();
          assert.ok(recover.x < expand.x, "reconnect sits left of the expand icon");
        }
        await ctx.toggleWorkspace(page, true, `${state}/${session}: expand again`);
        await ctx.finish(h, `${state}/${session}`, session !== "w1");
      });
    }
  }

await toggleFixture?.context.close();
}
