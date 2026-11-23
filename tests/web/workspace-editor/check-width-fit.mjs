// Stage sizing: workspace cards keep their widths while the chat absorbs changes to the window and session sidebar.
import assert from "node:assert/strict";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";
import { layoutStorage as seed } from "../../fixtures/layout-code.mjs";
import { CHAT_MIN, TREE_MIN } from "../../../web/shell/layout/layout-table.js";

export async function checkWidthFit(ctx) {
  const { boxes, near, dragBy } = ctx;
  const sameWork = (a, b, label) => {
    assert.equal(a.work.length, b.work.length, `${label}: same workspace groups`);
    a.work.forEach((group, i) => near(group.width, b.work[i].width, `${label}: workspace group ${i} keeps its width`));
  };
  const engines = [["chromium", ctx.browser], ...(ctx.firefox ? [["firefox", ctx.firefox]] : [])];
  for (const [engine, driver] of engines) {
    let h;
    for (const viewport of [1024, 1280, 1920]) for (const treeStart of ["open", "collapsed"]) {
      await ctx.step(`widths ${engine} ${viewport}: tree ${treeStart}, files 0 -> 1 -> split -> 0`, async () => {
        const storage = seed({ workspaceOpen: true, treeOpen: true, treePinned: true, treeWidth: TREE_MIN });
        if (h) await ctx.restart(h, storage, "w1", { width: viewport, height: 860 });
        else h = await ctx.open({ engine: driver, viewport: { width: viewport, height: 860 }, storage });
        const { page } = h;
        await page.locator("#file-tree li").first().waitFor();
        await ctx.widthsHold(page, "start");
        await dragBy(page, ".pi-stage-tree-splitter", -30);
        const wider = await ctx.widthsHold(page, "directory wider");
        near(wider.tree.width, TREE_MIN + 30, "the directory's own stage handle resizes it");
        await dragBy(page, ".pi-stage-tree-splitter", 30);
        near((await ctx.widthsHold(page, "directory back")).tree.width, TREE_MIN, "the directory returns to its width");
        await ctx.openFile(page, "main.py");
        const first = await ctx.widthsHold(page, "first file open");
        near(first.tree.width, TREE_MIN, "the first tab does not resize the directory");
        await ctx.openFile(page, "README.md");
        // A 1024px window cannot hold the chat, two workspace groups and a pinned tree at all their floors.
        if (treeStart === "collapsed" || viewport === 1024) await page.locator("#collapse-tree").click();
        // At 1024 the files opened beside the pinned tree got a narrow group (the chat at its floor), which the tree's
        // collapse leaves as it is; built-in layout 1 gives the workspace group its room back before it is split.
        if (viewport === 1024) {
          await page.locator("#layout-presets").click();
          await page.locator('[data-action="apply-layout"][data-preset="builtin:1"]').click();
          await page.waitForTimeout(300);
        }
        if (engine === "chromium") {
          await ctx.dragToRightEdge(page, "README.md");
          assert.equal(await ctx.groups(page), 3, "chat and two split workspace groups");
        }
        const split = await ctx.widthsHold(page, "split");
        if (split.tree) {
          await page.locator("#collapse-tree").click();
          const collapsed = await ctx.widthsHold(page, "directory collapsed");
          sameWork(collapsed, split, "directory collapsed");
          near(collapsed.chat.width - split.chat.width, split.tree.width + 8, "the chat absorbs the directory column");
          await page.locator("#toggle-tree").click();
          const expanded = await ctx.widthsHold(page, "directory expanded");
          near(expanded.tree.width, split.tree.width, "expanding restores the directory width");
          sameWork(expanded, split, "directory expanded");
        }
        const settled = await boxes(page);
        await page.locator("#toggle-session-sidebar").click();
        const folded = await ctx.widthsHold(page, "session sidebar collapsed");
        sameWork(folded, settled, "session sidebar collapsed");
        assert.ok(folded.chat.width > settled.chat.width, "only the chat grows into the sidebar's room");
        await page.locator("#expand-session-sidebar").click();
        await page.reload(); await selectSession(page, "w1");
        await page.locator(".pi-tab").first().waitFor();
        const reloaded = await ctx.widthsHold(page, "reloaded");
        sameWork(reloaded, settled, "reload");
        for (const key of ["side", "chat", "tree"]) near(reloaded[key]?.width ?? 0, settled[key]?.width ?? 0, `reload keeps ${key} width`);
        for (const resized of [viewport + 160, viewport + 400, viewport]) {
          await page.setViewportSize({ width: resized, height: 860 });
          const fitted = await ctx.widthsHold(page, `window ${resized}`);
          sameWork(fitted, settled, `window ${resized}`);
          near(fitted.chat.width - settled.chat.width, resized - viewport, "the chat alone absorbs the window change");
        }
        // A window too narrow for the workspace groups beside the chat's floor squeezes them; back at the old width
        // they return to their own widths first and the chat to its width (preferred sizes, not the squeezed ones).
        // 40px narrower than the chat's floor allows: the chat stops there and the workspace groups give the 40px.
        const narrow = Math.round(viewport - (settled.chat.width - CHAT_MIN) - 40);
        await page.setViewportSize({ width: narrow, height: 860 });
        const squeezed = await ctx.widthsHold(page, `window ${narrow}`);
        near(squeezed.chat.width, CHAT_MIN, `at ${narrow} the chat stops at its floor`);
        assert.ok(squeezed.work.reduce((sum, group) => sum + group.width, 0) < settled.work.reduce((sum, group) => sum + group.width, 0), "and the workspace groups give way");
        await page.setViewportSize({ width: viewport, height: 860 });
        const restored = await ctx.widthsHold(page, `window ${viewport} again`);
        sameWork(restored, settled, `back from ${narrow}`);
        near(restored.chat.width, settled.chat.width, `back from ${narrow}: the chat returns to its width`);
        for (const path of ["main.py", "README.md"]) {
          await ctx.tab(page, path).hover(); await ctx.tab(page, path).locator('[data-action="close-tab"]').click();
          await ctx.tab(page, path).waitFor({ state: "detached" });
        }
        assert.equal(await ctx.groups(page), 1, "closing all tabs leaves only the chat group");
        if (!await ctx.stageOpen(page)) await ctx.toggleWorkspace(page, true, "empty: reopen directory");
        if (!await page.locator("#file-tree").isVisible()) await page.locator("#toggle-tree").click();
        near((await ctx.widthsHold(page, "last file closed")).tree.width, TREE_MIN, "closing the last tab keeps the saved directory width");
        await ctx.finish(h, `widths ${engine} ${viewport} ${treeStart}`, false);
      });
    }
    await h?.context.close();
  }
}
