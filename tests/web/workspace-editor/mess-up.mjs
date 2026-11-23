/** Resize the session/tree columns and split tabs, with unsaved text, two shells and a non-layout preference to keep.
 * Open with `terminals: []`: the workspace starts its first shell itself. */
import assert from "node:assert/strict";

export async function messUp(ctx, page) {
    await page.locator('#desktop-stage .pi-term[data-shell="shell"] .xterm').waitFor();
    await ctx.openFile(page, "main.py"); await ctx.openFile(page, "README.md"); await ctx.openFile(page, "notes.txt");
    await ctx.dragToRightEdge(page, "README.md");
    assert.equal(await ctx.groups(page), 3, "chat plus two workspace groups");
    await ctx.tab(page, "main.py").click();
    await ctx.type(page, "main.py", "# unsaved");
    await ctx.tab(page, "notes.txt").click();
    await ctx.dragBy(page, "#session-splitter", 50);
    await ctx.dragBy(page, ".pi-stage-tree-splitter", -40);
    await page.locator("#new-terminal").click();
    await page.locator('#desktop-stage .pi-term[data-shell="shell-2"] .xterm').waitFor();
    await page.locator("#files-new").click(); await page.locator('.pi-files-menu [data-action="toggleHidden"]').click(); // not layout: must survive the reset
    await page.locator('#desktop-stage .pi-term[data-shell="shell"] .xterm').evaluate((node) => { node.dataset.mark = "kept"; });
  }
