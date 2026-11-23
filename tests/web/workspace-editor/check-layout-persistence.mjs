// ── persistence: fresh / saved + reload / used + reload / damaged ──
// ── directory sidebar ──
import assert from "node:assert/strict";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";
import { layoutKey } from "../../../web/shell/layout/layout-store.js";

export async function checkLayoutPersistence(ctx) {
await ctx.step("stage layout persistence", async () => {
    const h = await ctx.open({ storage: ctx.OPEN });
    const { page, fs } = h;
    assert.equal(await ctx.tabs(page), 0, "fresh: no workspace tabs saved");
    assert.equal(await ctx.groups(page), 1, "fresh: only the chat group");
    const chatWide = await ctx.width(page, ".pi-chatcol");
    await ctx.openFile(page, "main.py"); await ctx.openFile(page, "README.md"); await ctx.openFile(page, "notes.txt");
    assert.equal(await ctx.groups(page), 2, "the first tab creates a workspace group beside chat");
    assert.ok(await ctx.width(page, ".pi-chatcol") < chatWide - 200, "the chat makes room for workspace tabs");
    await ctx.dragToRightEdge(page, "README.md");
    assert.equal(await ctx.groups(page), 3);
    await ctx.tab(page, "main.py").click();
    fs.reads.length = 0;
    await page.reload(); await selectSession(page, "w1");
    await page.locator(".pi-tab").first().waitFor();
    assert.equal(await ctx.stageOpen(page), true, "saved + reload: the stage is open");
    assert.equal(await ctx.groups(page), 3, "saved + reload: chat and both workspace groups return");
    assert.deepEqual((await page.locator(".pi-tab").evaluateAll((nodes) => nodes.map((node) => node.dataset.path))).sort(), ["README.md", "main.py", "notes.txt"]);
    assert.equal(await page.locator('.dv-tab.dv-active-tab .pi-tab[data-path="main.py"]').count(), 1, "the active tab is restored");
    await page.waitForTimeout(400);
    assert.equal(fs.reads.includes("notes.txt"), false, "a hidden restored tab is not read until shown");
    await ctx.tab(page, "notes.txt").click();
    await ctx.body(page, "notes.txt").locator(".cm-content").waitFor();
    assert.ok(fs.reads.includes("notes.txt"), "and is read when shown");
    await selectSession(page, "w2");
    assert.equal(await ctx.groups(page), 1, "a fresh session has its own chat-only grid");
    assert.equal(await ctx.tabs(page), 0);
    await selectSession(page, "w1");
    await ctx.tab(page, "notes.txt").waitFor();
    assert.equal(await ctx.groups(page), 3, "switch away and back: the split is restored");
    // Each session saves its own grid once it changes; a session that only showed its chat saves nothing or a chat-only grid.
    const grids = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((key) => key.startsWith("pi.layout.grid.")).map((key) => [key, Object.keys(JSON.parse(localStorage.getItem(key)).panels)])));
    assert.equal(grids["pi.layout.grid.w1"].length, 4, "w1's grid holds the chat and its three tabs");
    assert.ok(!grids["pi.layout.grid.w2"] || grids["pi.layout.grid.w2"].join() === "stage:chat", "w2's grid, if saved, is its own chat-only one");
    assert.equal(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith("pi.editor."))), false, "desktop never writes a phone editor layout");
    for (const path of ["main.py", "README.md", "notes.txt"]) { await ctx.tab(page, path).hover(); await ctx.tab(page, path).locator('[data-action="close-tab"]').click(); await ctx.tab(page, path).waitFor({ state: "detached" }); }
    assert.equal(await ctx.groups(page), 1, "closing all tabs leaves the chat group");
    await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem("pi.layout.grid.w1"))?.panels ?? {}).join() === "stage:chat");
    const empty = JSON.parse(await ctx.stored(page, "pi.layout.grid.w1"));
    assert.equal(empty.panels["stage:chat"].contentComponent, "chat", "the saved empty stage keeps its chat panel");
    ctx.near(await ctx.width(page, ".pi-chatcol"), chatWide, "closing the last tab gives the width back to chat");
    await page.reload(); await selectSession(page, "w1");
    assert.equal(await ctx.groups(page), 1, "used + reload: only chat returns");
    assert.equal(await ctx.tabs(page), 0);
    await ctx.finish(h, "persistence");

    const gone = await ctx.open({ storage: ctx.OPEN });
    await ctx.openFile(gone.page, "main.py"); await ctx.openFile(gone.page, "notes.txt");
    gone.fs.files.delete("notes.txt");
    await gone.page.reload(); await selectSession(gone.page, "w1");
    await ctx.tab(gone.page, "main.py").waitFor();
    await gone.page.waitForTimeout(800);
    assert.equal(await ctx.tab(gone.page, "notes.txt").count(), 0, "the vanished file's tab is gone");
    assert.equal(await ctx.tab(gone.page, "main.py").count(), 1);
    assert.equal(await gone.page.locator('#desktop-stage [role="alert"]:not(.dv-live-region-assertive)').count(), 0, "no error is shown for it");
    await ctx.finish(gone, "vanished file");

    let bad;
    for (const [name, raw] of [["garbage", "{nope"], ["foreign panel", JSON.stringify({ grid: { root: { type: "leaf", data: { id: "1", views: ["x"], activeView: "x" }, size: 1 }, width: 1, height: 1, orientation: "HORIZONTAL" }, panels: { x: { id: "x", contentComponent: "chat" } } })]]) {
      if (bad) await ctx.restart(bad, { ...ctx.OPEN, "pi.layout.grid.w1": raw });
      else bad = await ctx.open({ storage: { ...ctx.OPEN, "pi.layout.grid.w1": raw } });
      assert.equal(await ctx.groups(bad.page), 1, `${name}: fresh chat group`);
      assert.equal(await ctx.tabs(bad.page), 0, `${name}: no workspace tabs`);
      await ctx.openFile(bad.page, "main.py");
      await ctx.finish(bad, `damaged save: ${name}`, false);
    }
    await bad.context.close();
  });

await ctx.step("directory sidebar: enter, up, filter, hidden, collapse, width", async () => {
    const h = await ctx.open({ storage: ctx.OPEN });
    const { page } = h;
    await page.locator("#file-tree li").first().waitFor();
    // The pinned tree has its own stage handle even before any workspace tab is open.
    {
      const before = await ctx.width(page, "#file-tree");
      const handle = await page.locator(".pi-stage-tree-splitter").boundingBox();
      await page.mouse.move(handle.x + 3, handle.y + 300);
      await page.mouse.down(); await page.mouse.move(handle.x - 47, handle.y + 300, { steps: 5 }); await page.mouse.up();
      const after = await ctx.width(page, "#file-tree");
      assert.ok(Math.abs(after - before - 50) <= 2, `the independent directory column resizes (${before} -> ${after})`);
      assert.ok(Math.abs(Number(await ctx.stored(page, layoutKey("treeWidth"))) - after) <= 2, "and saves that as the sidebar width");
    }
    const names = () => page.locator("#file-tree li .pi-files-name").allTextContents();
    assert.deepEqual(await names(), ["src", "main.py", "notes.txt", "README.md"], "folders first, dotfiles hidden");
    await ctx.row(page, "src").click();
    await page.locator('#file-tree li[data-path="src/a.py"]').waitFor();
    assert.deepEqual(await names(), ["a.py", "b.py"], "entering a folder lists only that folder");
    assert.equal(await page.locator(".pi-files-crumb.is-current").textContent(), "src", "the breadcrumb names the folder");
    await page.locator("#files-search-toggle").click();
    await page.locator("#files-filter").fill("B.");
    assert.deepEqual(await names(), ["b.py"], "the filter narrows the current directory");
    await page.locator("#files-filter").fill("zzz");
    assert.equal(await page.locator('#file-tree [data-state="no-match"]').count(), 1);
    await page.locator("button.pi-files-crumb").last().click();
    await page.locator('#file-tree li[data-path="main.py"]').waitFor();
    assert.equal(await page.locator("#files-filter").inputValue(), "", "changing directory clears the filter");
    await page.locator("#files-new").click();
    await page.locator('.pi-files-menu [data-action="toggleHidden"]').click();
    await page.locator('#file-tree li[data-path=".env"]').waitFor();
    await page.locator("#files-new").click();
    await page.locator('.pi-files-menu [data-action="toggleHidden"]').click();
    await page.locator('#file-tree li[data-path=".env"]').waitFor({ state: "detached" });
    await page.locator("#files-new").click();
    await page.locator('.pi-files-menu [data-action="refresh"]').click();
    await ctx.openFile(page, "main.py");
    // The tree column paints the dedicated --pi-tree token: a marker value reaches it.
    const paints = (selector) => page.evaluate((target) => {
      document.documentElement.style.setProperty("--pi-tree", "rgb(1, 2, 3)");
      const color = getComputedStyle(document.querySelector(target)).backgroundColor;
      document.documentElement.style.removeProperty("--pi-tree");
      return color;
    }, selector);
    assert.equal(await paints(".pi-tree"), "rgb(1, 2, 3)", "the tree column paints --pi-tree");

    // Collapse the pinned directory, reload keeps it, then expand it again.
    await page.locator("#collapse-tree").click();
    assert.equal(await page.locator("#file-tree").isVisible(), false);
    await page.locator("#toggle-tree").waitFor();
    assert.equal(await page.locator(".pi-rail").count(), 0, "there is no directory rail");
    await assertUniqueIds(page, "tree collapsed");
    await page.reload(); await selectSession(page, "w1");
    await page.locator("#toggle-tree").waitFor();
    assert.equal(await page.locator("#file-tree").isVisible(), false, "collapsed state is saved");
    await page.locator("#toggle-tree").click();
    await page.locator("#file-tree").waitFor({ state: "visible" });
    // dragging the tree splitter changes and saves its width
    const before = (await page.locator("#file-tree").boundingBox()).width;
    const handle = await page.locator(".pi-stage-tree-splitter").boundingBox();
    await page.mouse.move(handle.x + 3, handle.y + 200);
    await page.mouse.down(); await page.mouse.move(handle.x - 77, handle.y + 200, { steps: 6 }); await page.mouse.up();
    const after = (await page.locator("#file-tree").boundingBox()).width;
    assert.ok(Math.abs(after - before - 80) <= 2, `tree widened by the drag (${before} -> ${after})`);
    assert.ok(Math.abs(Number(await ctx.stored(page, layoutKey("treeWidth"))) - after) <= 2, "width saved");
    await ctx.finish(h, "sidebar");
  });
}
