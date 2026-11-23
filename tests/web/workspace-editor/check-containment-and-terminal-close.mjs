// ── every fixed region keeps to its own box when squeezed (the terminal is a dockview tab inside the workspace) ──
// ── phone: the workspace is a full-screen overlay, the tree a sheet over the editor ──
import assert from "node:assert/strict";
import { openMockWorkbench } from "../../fixtures/workspace-mock.mjs";
import { SNAPSHOTS } from "../../fixtures/workspace-mock/session-snapshots.mjs";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { createMockFs } from "../../fixtures/workspace-mock/create-mock-fs.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";
import { decodeLayoutCode, layoutStorage as seed, openFromLayoutCode } from "../../fixtures/layout-code.mjs";

export async function checkContainmentAndTerminalClose(ctx) {
await ctx.step("regions keep to their own box", async () => {
    const scenarios = [
      ["desktop, terminal tab shown", { viewport: { width: 1440, height: 900 }, storage: seed({ workspaceOpen: true, treeOpen: true, treePinned: true }), files: false }],
      ["desktop, tree narrowest", { viewport: { width: 1440, height: 900 }, storage: seed({ workspaceOpen: true, treeOpen: true, treePinned: true, treeWidth: 1 }), files: true }],
      ["desktop, session sidebar widest + tree widest", { viewport: { width: 1440, height: 900 }, storage: seed({ workspaceOpen: true, treeOpen: true, treePinned: true, sessionWidth: 5000, treeWidth: 5000 }), files: true }],
      ["desktop, narrow window", { viewport: { width: 780, height: 900 }, storage: seed({ workspaceOpen: true, treeOpen: true, treePinned: true }), files: true }],
      ["desktop, split workspace cards", { viewport: { width: 1440, height: 900 }, storage: seed({ workspaceOpen: true, treeOpen: true, treePinned: true }), files: true, split: true }],
    ];
    for (const [label, scenario] of scenarios) {
      const h = await openMockWorkbench(ctx.browser, ctx.server.url, { fs: createMockFs(ctx.FILES), terminals: [{ name: "shell" }], snapshots: { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, state: "running" } }, viewport: scenario.viewport, mobile: scenario.mobile, storage: scenario.storage });
      ctx.openOnes.push(h.context);
      const { page } = h;
      if (scenario.mobile) await page.locator("#open-sidebar").click();
      await selectSession(page, "w1");
      await page.locator(".pi-term .xterm").waitFor({ state: "visible" });
      if (scenario.files) { await ctx.openFile(page, "main.py"); await page.locator('.pi-file[data-path="main.py"] .cm-content').waitFor(); }
      if (scenario.split) { await ctx.openFile(page, "README.md"); await ctx.dragToRightEdge(page, "README.md"); }
      await page.waitForTimeout(400);
      const seen = await page.evaluate((regions) => regions.flatMap((region) => [...document.querySelectorAll(region.box)]).filter((node) => { const box = node.getBoundingClientRect(); return box.width > 8 && box.height > 8 && node.checkVisibility({ visibilityProperty: true }); }).length, ctx.REGIONS);
      assert.ok(seen >= (scenario.files && !scenario.split ? 4 : 5), `${label}: the card regions are on screen (${seen})`);
      assert.deepEqual(await ctx.regionBleed(page), [], label);
      await ctx.finish(h, label);
    }
  });

await ctx.step("phone workspace overlay", async () => {
    const h = await openMockWorkbench(ctx.browser, ctx.server.url, { fs: createMockFs(ctx.FILES), viewport: { width: 390, height: 844 }, mobile: true });
    ctx.openOnes.push(h.context);
    const { page } = h;
    await page.locator("#open-sidebar").click();
    await selectSession(page, "w1");
    assert.equal(await page.locator(".topbar").isVisible(), true, "the phone keeps its top bar");
    assert.equal(await page.locator("#toggle-session-sidebar, #expand-session-sidebar").count(), 0, "no desktop collapse controls on the phone");
    await page.locator("#toggle-workspace").click();
    await page.locator(".pi-term .xterm").waitFor({ state: "visible" });
    await page.locator("#toggle-tree").click();
    await page.locator("#file-tree").waitFor({ state: "visible" });
    await ctx.row(page, "main.py").click();
    await ctx.tab(page, "main.py").waitFor();
    assert.equal(await page.locator("#file-tree").isVisible(), false, "opening a file leaves the sheet");
    await page.locator("#toggle-tree").click();
    await page.locator("#file-tree").waitFor({ state: "visible" });
    await page.locator("#toggle-workspace").click();
    await page.waitForFunction(() => document.querySelector("#workspace-pane")?.hidden === true);
    await assertUniqueIds(page, "phone");
    await ctx.finish(h, "phone");
  });
}
