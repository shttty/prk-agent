// One desktop grid: toggle maximizes chat without unmounting workspace tabs; directory floats or pins outside it.
import assert from "node:assert/strict";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";
import { layoutStorage as seed } from "../../fixtures/layout-code.mjs";
import { CHAT_MIN } from "../../../web/shell/layout/layout-table.js";

export async function checkUnifiedWorkspace(ctx) {
  const saved = (page, name) => ctx.stored(page, `pi.layout.${name}`);
  const box = (page, selector) => page.locator(selector).boundingBox();
  const stageHidden = (page) => page.waitForFunction(() => !document.querySelector("#desktop-stage")?.hasAttribute("data-open"));
  const stageShown = (page) => page.locator('#desktop-stage[data-open="true"]').waitFor();

  await ctx.step("one toggle: empty workspace opens a terminal; shortcuts maximize chat; the last tab closes it", async () => {
    const h = await ctx.open({ terminals: [] });
    const { page, sockets } = h;
    const xterm = page.locator('#desktop-stage .pi-term[data-shell="shell"] .xterm');
    assert.equal(await page.locator("#toggle-terminal, #new-terminal").count(), 0, "closed: only the workspace toggle");
    await page.locator("#toggle-workspace").click();
    await xterm.waitFor({ state: "visible" });
    assert.equal(await page.locator('#desktop-stage .pi-tab[data-kind="terminal"]').count(), 1, "a terminal tab opened by itself");
    assert.equal(await page.locator("#file-tree").isVisible(), false, "a nonempty workspace does not open the tree");
    assert.equal(await saved(page, "treeOpen"), null);
    const work = "#desktop-stage .dv-groupview:not(:has(.pi-chatcol))";
    const initial = { chat: await box(page, ".pi-chatcol"), work: await box(page, work) };
    for (const [name, expected] of [["chat", { x: 280, y: 8, width: 630, height: 884 }], ["work", { x: 918, y: 8, width: 514, height: 884 }]]) {
      for (const [key, value] of Object.entries(expected)) ctx.near(initial[name][key], value, `default ${name} ${key}`);
    }
    await xterm.evaluate((node) => { node.dataset.mark = "kept"; });
    for (const chord of ["Control+j", "Control+`", "Control+j"]) {
      await page.keyboard.press(chord); await stageHidden(page); await xterm.waitFor({ state: "hidden" });
      assert.equal(await page.locator(work).evaluateAll((nodes) => nodes.every((node) => { const r = node.getBoundingClientRect(); return !r.width || !r.height || !node.checkVisibility({ visibilityProperty: true }); })), true, "collapse hides workspace groups in place");
      ctx.near((await box(page, ".pi-chatcol")).width, (await box(page, ".pi-stage-grid")).width - 8, "collapse maximizes the chat group");
      await page.keyboard.press(chord); await stageShown(page); await xterm.waitFor({ state: "visible" });
      ctx.near((await box(page, work)).width, initial.work.width, "expanding restores workspace geometry");
    }
    assert.equal(await xterm.getAttribute("data-mark"), "kept", "toggling keeps the xterm");
    assert.equal(sockets.length, 1, "and its socket");
    assert.equal(await page.locator('#desktop-stage .pi-tab[data-kind="terminal"]').count(), 1, "and does not open a second shell");
    await page.locator('#desktop-stage .pi-tab[data-shell="shell"]').hover();
    await page.locator('#desktop-stage .pi-tab[data-shell="shell"] [data-action="close-tab"]').click();
    await page.locator("#confirm-end-terminal").click();
    await stageHidden(page);
    assert.equal(await saved(page, "workspaceOpen"), "false");
    await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem("pi.layout.grid.w1"))?.panels ?? {}).join() === "stage:chat");
    assert.equal(await ctx.groups(page), 1, "the saved empty stage keeps chat alone");
    await page.locator("#toggle-workspace").click(); await xterm.waitFor({ state: "visible" });
    assert.equal(sockets.length, 2, "reopening an empty workspace starts a fresh shell");
    await assertUniqueIds(page, "one toggle"); await ctx.finish(h, "one toggle");
  });

  await ctx.step("tree popover: floats under stage controls, takes no width, closes itself", async () => {
    const h = await ctx.open({ storage: seed({ workspaceOpen: true }) }, "c1");
    const { page } = h;
    const tree = page.locator("#file-tree");
    await tree.waitFor({ state: "visible" });
    assert.equal(await tree.getAttribute("data-mode"), "popover", "the default tree is a popover");
    assert.equal(await saved(page, "treeOpen"), "true", "an empty workspace opens the tree for a file pick");
    const stage = await box(page, "#desktop-stage");
    const popover = await box(page, "#file-tree");
    assert.ok(popover.x >= stage.x && popover.x + popover.width <= stage.x + stage.width, "the popover sits inside the stage");
    const strip = await box(page, ".pi-stage-strip");
    assert.ok(popover.y >= strip.y + strip.height, "the popover hangs below the stage buttons");
    assert.ok(await tree.evaluate((node) => getComputedStyle(node, "::before").backdropFilter !== "none"), "frosted glass");
    await ctx.openFile(page, "main.py"); await tree.waitFor({ state: "hidden" });
    assert.equal(await saved(page, "treeOpen"), "false", "picking a file closes the popover");
    const closedWidth = (await box(page, ".pi-stage-grid")).width;
    await page.locator("#toggle-tree").click(); await tree.waitFor({ state: "visible" });
    assert.equal((await box(page, ".pi-stage-grid")).width, closedWidth, "an open popover takes no grid width");
    await page.locator("#files-new").click();
    await page.locator('[data-portal] [role="menu"]').waitFor({ state: "visible" });
    await page.keyboard.press("Escape"); await page.locator('[data-portal] [role="menu"]').waitFor({ state: "detached" });
    assert.equal(await tree.isVisible(), true, "the first Escape closes only the file menu");
    await page.keyboard.press("Escape"); await tree.waitFor({ state: "hidden" });
    await page.locator("#toggle-tree").click(); await tree.waitFor({ state: "visible" });
    await page.mouse.click(400, 400); await tree.waitFor({ state: "hidden" });
    await ctx.tab(page, "main.py").hover(); await ctx.tab(page, "main.py").locator('[data-action="close-tab"]').click();
    await stageHidden(page);
    assert.equal(await saved(page, "workspaceOpen"), "false");
    await page.locator("#toggle-workspace").click(); await tree.waitFor({ state: "visible" });
    await assertUniqueIds(page, "popover"); await ctx.finish(h, "popover");
  });

  await ctx.step("pinned tree: independent stage column that a file pick leaves open", async () => {
    const h = await ctx.open({ storage: seed({ workspaceOpen: true }) }, "c1");
    const { page } = h;
    await page.locator("#file-tree").waitFor({ state: "visible" }); await ctx.openFile(page, "main.py");
    const before = await box(page, ".pi-stage-grid");
    const work = "#desktop-stage .dv-groupview:not(:has(.pi-chatcol))";
    const workBefore = await box(page, work);
    await page.locator("#toggle-tree").click(); await page.locator("#pin-tree").click();
    assert.equal(await page.locator("#file-tree").getAttribute("data-mode"), "pinned");
    assert.equal(await saved(page, "treePinned"), "true");
    assert.equal(await page.locator("#file-tree").evaluate((node) => node.parentElement.id), "desktop-stage", "the tree is outside the grid, directly under the stage");
    await page.waitForTimeout(300);
    const treeBox = await box(page, "#file-tree");
    ctx.near((await box(page, ".pi-stage-grid")).width, before.width - treeBox.width - 8, "pinning takes an independent column from the grid");
    // The workspace group keeps its width, except where the chat card would fall under its floor (then it gives way).
    const grid = await box(page, ".pi-stage-grid");
    ctx.near((await box(page, work)).width, Math.min(workBefore.width, grid.width - (CHAT_MIN + 8) - 8), "pinning leaves the workspace group's width alone where the chat has room");
    assert.ok((await box(page, ".pi-chatcol")).width >= CHAT_MIN - 1, "and the chat card keeps its floor");
    assert.equal(await page.locator("#toggle-tree").count(), 0, "the strip toggle gives way to the pinned tree's collapse");
    const stage = await box(page, "#desktop-stage");
    ctx.near(treeBox.x + treeBox.width, stage.x + stage.width - 4, "the pinned tree sits at the stage's right edge");
    ctx.near(treeBox.y, stage.y + 4, "the pinned tree is a full-height stage card");
    await ctx.openFile(page, "README.md");
    assert.equal(await page.locator("#file-tree").isVisible(), true, "a file pick leaves the pinned tree open");
    await page.reload(); await selectSession(page, "c1"); await page.locator("#file-tree").waitFor({ state: "visible" });
    assert.equal(await page.locator("#file-tree").getAttribute("data-mode"), "pinned", "pinned survives a reload");
    await page.locator("#collapse-tree").click(); await page.locator("#toggle-tree").waitFor();
    await page.locator("#toggle-tree").click(); await page.locator("#pin-tree").click();
    assert.equal(await page.locator("#file-tree").getAttribute("data-mode"), "popover", "unpinned it floats again");
    await ctx.finish(h, "pinned");
  });

  await ctx.step("dirty stage: split and pin survive reload; reset keeps shells and restores the open default grid", async () => {
    const h = await ctx.open({ storage: seed({ workspaceOpen: true }), terminals: [] });
    const { page } = h;
    const xterm = (name) => page.locator(`#desktop-stage .pi-term[data-shell="${name}"] .xterm`);
    await xterm("shell").waitFor({ state: "visible" });
    await page.locator("#toggle-tree").click(); await ctx.openFile(page, "main.py");
    await page.locator("#new-terminal").click(); await xterm("shell-2").waitFor({ state: "visible" });
    const area = await page.locator("#desktop-stage .dv-groupview", { has: page.locator('.pi-tab[data-shell="shell"]') }).boundingBox();
    const tab = await box(page, '.pi-tab[data-shell="shell-2"]');
    await page.mouse.move(tab.x + 20, tab.y + tab.height / 2); await page.mouse.down();
    await page.mouse.move(tab.x + 40, tab.y + 60, { steps: 4 });
    await page.mouse.move(area.x + area.width / 2, area.y + area.height - 30, { steps: 12 });
    await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(300);
    assert.equal(await ctx.groups(page), 3, "chat and two vertically split workspace groups");
    await page.locator("#toggle-tree").click(); await page.locator("#pin-tree").click();
    const state = async () => ({ groups: await ctx.groups(page), pinned: await saved(page, "treePinned"), shells: await page.locator('#desktop-stage .pi-tab[data-kind="terminal"]').count(),
      cards: await page.locator("#desktop-stage .dv-groupview").evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); })) });
    await page.waitForTimeout(300);
    const dirty = await state();
    assert.deepEqual([dirty.groups, dirty.pinned, dirty.shells], [3, "true", 2]);
    await page.reload(); await selectSession(page, "w1");
    await xterm("shell-2").waitFor({ state: "visible" }); await page.locator("#file-tree").waitFor({ state: "visible" });
    assert.deepEqual(await state(), dirty, "reload restores split card geometry, pinned tree and both shells");
    await xterm("shell-2").evaluate((node) => { node.dataset.mark = "kept"; });
    await page.locator("#open-settings").click(); await page.locator("#reset-layout").click();
    await page.locator('#settings-status[data-status="reset"]').waitFor(); await page.keyboard.press("Escape");
    await stageShown(page);
    assert.deepEqual([await saved(page, "treePinned"), await saved(page, "treeWidth")], [null, null], "reset restores directory scalar defaults");
    // After the reset both shells share one group; a shell's xterm is in the DOM only while its tab is the shown one.
    await page.locator('#desktop-stage .pi-tab[data-shell="shell-2"]').click(); await xterm("shell-2").waitFor({ state: "visible" });
    assert.equal(await xterm("shell-2").getAttribute("data-mark"), "kept", "reset does not rebuild the shell");
    assert.equal(await ctx.groups(page), 2, "reset keeps chat and one workspace group");
    assert.equal(await page.locator('#desktop-stage .pi-tab[data-kind="terminal"]').count(), 2, "reset keeps both shell tabs");
    const work = await box(page, "#desktop-stage .dv-groupview:not(:has(.pi-chatcol))");
    assert.ok((await box(page, ".pi-chatcol")).x < work.x, "reset returns all workspace tabs right of chat");
    assert.equal(await ctx.tab(page, "main.py").count(), 1, "reset: the file is still open");
    await ctx.finish(h, "dirty stage");
  });
}
