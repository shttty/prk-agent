// ── session sidebar width: drag, limits, collapse keeps it, window resize never rewrites it, footer stays intact ──
// ── keyboard: a collapse/expand button that disappears hands focus to its counterpart (was: focus fell to <body>) ──
// ── the terminal toggle is pressed only where a terminal is shown (was: pressed and disabled on a closed worker) ──
// ── settings: archive and instances moved here; reset layout; layout code ──
import assert from "node:assert/strict";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";
import { decodeLayoutCode, layoutStorage as seed, openFromLayoutCode } from "../../fixtures/layout-code.mjs";
import { CHAT_MIN } from "../../../web/shell/layout/layout-table.js";
import { LAYOUT } from "../../../web/shell/layout/layout-store.js";
import { SESSION_MIN } from "../../../web/shell/layout/layout-table.js";
import { layoutKey } from "../../../web/shell/layout/layout-store.js";

export async function checkSidebarAndEditorSelection(ctx) {
await ctx.step("session sidebar width", async () => {
    const h = await ctx.open({ viewport: { width: 1440, height: 860 }, storage: ctx.OPEN });
    const { page } = h;
    await ctx.openFile(page, "main.py");
    await page.locator("#collapse-tree").click();
    const initial = await ctx.widthsHold(page, "session width start");
    const side = () => ctx.width(page, ".desktop-sidebar");
    const start = await side();
    ctx.near(start, LAYOUT.sessionWidth, "default width");
    await ctx.dragBy(page, "#session-splitter", 60);
    ctx.near(await side(), start + 60, "the right edge drags the sidebar wider");
    assert.equal(await ctx.stored(page, layoutKey("sessionWidth")), String(start + 60), "and saves it");
    const wider = await ctx.widthsHold(page, "session sidebar wider");
    initial.work.forEach((group, i) => ctx.near(wider.work[i].width, group.width, `sidebar drag keeps workspace group ${i} width`));
    ctx.near(initial.chat.width - wider.chat.width, 60, "the chat alone gives the sidebar its extra width");
    await ctx.dragBy(page, "#session-splitter", 2000);
    const widest = await ctx.widthsHold(page, "session sidebar dragged to its limit");
    assert.ok(widest.chat.width >= CHAT_MIN - 1, "the chat stops it");
    await ctx.dragBy(page, "#session-splitter", -2000);
    const narrowest = await ctx.widthsHold(page, "session sidebar at its minimum");
    ctx.near(narrowest.side.width, SESSION_MIN, "minimum");
    // footer row (status, theme, settings) and session rows keep their parts apart at the minimum
    const crowded = await page.evaluate(() => {
      const bad = [];
      const side = document.querySelector(".desktop-sidebar").getBoundingClientRect();
      for (const row of [".management-sidebar-footer", ".management-brand", ".management-sidebar-heading", ".management-session-row.is-selected .management-session-select"]) {
        const parts = [...document.querySelector(row).children, ...(row.includes("worker") ? [document.querySelector(".management-session-row.is-selected .management-session-menu")] : [])].filter((node) => node.getBoundingClientRect().width > 0);
        for (const [index, node] of parts.entries()) {
          const box = node.getBoundingClientRect();
          if (box.right > side.right - 1) bad.push(`${row} part ${index} runs out of the sidebar`);
          for (const other of parts.slice(index + 1)) { const b = other.getBoundingClientRect(); if (box.left < b.right - 1 && b.left < box.right - 1 && box.top < b.bottom - 1 && b.top < box.bottom - 1 && node.parentElement === other.parentElement) bad.push(`${row} parts ${index} overlap`); }
        }
      }
      return bad;
    });
    assert.deepEqual(crowded, [], "the sidebar rows stay intact at the minimum width");
    await ctx.dragBy(page, "#session-splitter", 90);
    const chosen = await side();
    await page.locator("#toggle-session-sidebar").click();
    await ctx.widthsHold(page, "session sidebar collapsed");
    await page.locator("#expand-session-sidebar").click();
    ctx.near(await side(), chosen, "expanding restores the width");
    await page.setViewportSize({ width: 1024, height: 860 });
    await page.waitForTimeout(300);
    const squeezed = await ctx.boxes(page);
    // 1024 cannot hold the chat card's floor beside the 514 workspace card: the chat stops at its floor and the
    // workspace group gives way (one group: it takes what the floor leaves).
    ctx.near(squeezed.chat.width, CHAT_MIN, "a narrow window stops the chat card at its floor");
    ctx.near(squeezed.work.reduce((sum, group) => sum + group.width + 8, 0), squeezed.grid.width - (CHAT_MIN + 8), "the workspace takes what the chat's floor leaves");
    await page.setViewportSize({ width: 1440, height: 860 });
    ctx.near((await ctx.widthsHold(page, "window back")).side.width, chosen, "a smaller window does not rewrite it");
    assert.equal(await ctx.stored(page, layoutKey("sessionWidth")), String(Math.round(chosen)));
    await ctx.finish(h, "session width");
    // a finger: the handle's hit area reaches 10px either side of the line
    const touch = await ctx.open({ viewport: { width: 1280, height: 860 }, hasTouch: true });
    const handle = await touch.page.locator("#session-splitter").boundingBox();
    const hits = await touch.page.evaluate(({ x, y }) => [x - 10, x + 10].map((px) => document.elementFromPoint(px, y)?.id), { x: handle.x + handle.width / 2, y: handle.y + 300 });
    assert.deepEqual(hits, ["session-splitter", "session-splitter"], "touch hit area");
    await ctx.finish(touch, "session touch");
  });

await ctx.step("collapse and expand keep keyboard focus", async () => {
    const h = await ctx.open({ storage: ctx.OPEN });
    const { page } = h;
    await ctx.openFile(page, "main.py");
    const focused = () => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    for (const [from, to] of [["collapse-tree", "toggle-tree"], ["toggle-tree", "collapse-tree"], ["toggle-session-sidebar", "expand-session-sidebar"], ["expand-session-sidebar", "toggle-session-sidebar"]]) {
      await page.locator(`#${from}`).focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction((id) => document.activeElement?.id === id, to, { timeout: 2000 }).catch(() => {});
      assert.equal(await focused(), to, `Enter on #${from} leaves focus on #${to}`);
    }
    await ctx.finish(h, "focus");
  });

await ctx.step("workspace toggle follows the session: live sessions open a shell, a closed one only files", async () => {
    // (a pinned tree holds the closed worker's empty workspace open; a popover would be dismissed by the press on the next session row, and an empty workspace closes itself)
    const h = await ctx.open({ storage: seed({ workspaceOpen: true, treeOpen: true, treePinned: true }), terminals: [] });
    const { page } = h;
    await page.locator('#desktop-stage .pi-term[data-shell="shell"] .xterm').waitFor({ state: "visible" });
    const toggle = () => page.locator("#toggle-workspace").evaluate((node) => [node.disabled, node.getAttribute("aria-expanded")]);
    assert.deepEqual(await toggle(), [false, "true"], "worker with its workspace open");
    await selectSession(page, "c1");
    await page.locator("#file-tree").waitFor({ state: "visible" });
    assert.deepEqual(await toggle(), [false, "true"], "A closed worker has a workspace too");
    assert.equal(await page.locator("#new-terminal, .pi-term").count(), 0, "but no terminal and no new-terminal button");
    await selectSession(page, "m1");
    await page.locator('#desktop-stage .pi-term[data-shell="shell"] .xterm').waitFor({ state: "visible" });
    assert.deepEqual(await toggle(), [false, "true"], "A coordination worker opens a shell like other live sessions");
    await selectSession(page, "w1");
    await page.locator('#desktop-stage .pi-term[data-shell="shell"] .xterm').waitFor({ state: "visible" });
    assert.equal(await page.locator('#desktop-stage .pi-tab[data-kind="terminal"]').count(), 1, "back on the worker its shell tab is restored, not opened twice");
    await ctx.finish(h, "workspace toggle state");
  });

await ctx.step("settings: archive and instances", async () => {
    const h = await ctx.open();
    const { page } = h;
    assert.equal(await page.locator(".management-sidebar-footer").evaluate((node) => [...node.querySelectorAll("button")].map((button) => button.id).join()), "theme-toggle,open-settings", "the footer holds the theme switch and the settings button");
    await page.locator("#open-settings").click();
    await page.locator("#open-archive").click();
    await page.locator("#settings-archive").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("#settings-dialog").waitFor({ state: "hidden" });
    await page.locator("#open-settings").click();
    await page.locator("#open-targets").click();
    await page.locator('#settings-targets').waitFor();
    await assertUniqueIds(page, "settings");
    await ctx.finish(h, "settings", false);
    await page.keyboard.press("Escape");
    await page.locator("#settings-dialog").waitFor({ state: "hidden" });
    // the retarget dialog of a closed worker renders (it crashed on the same targetMap(state) mistake as the archive view)
    const closed = h;
    await selectSession(closed.page, "c1");
    await closed.page.locator('[data-session-id="c1"] .management-session-menu').click();
    await closed.page.locator("#retarget-session").click();
    await closed.page.locator('#management-dialog[data-kind="retarget"] .mantine-Modal-content').waitFor();
    await ctx.finish(closed, "retarget dialog");
  });
}
