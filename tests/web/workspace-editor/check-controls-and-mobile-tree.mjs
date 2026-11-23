// ── control group: workspace toggle stays put; presets appear while open, stage strip shares the tab row ──
// ── phone: the workspace overlay opens on a terminal tab, with the new-terminal button in its bar ──
import assert from "node:assert/strict";
import { openMockWorkbench } from "../../fixtures/workspace-mock.mjs";
import { assertUniqueIds } from "../../fixtures/workspace-mock/assert-unique-ids.mjs";
import { createMockFs } from "../../fixtures/workspace-mock/create-mock-fs.mjs";
import { selectSession } from "../../fixtures/workspace-mock/select-session.mjs";

export async function checkControlsAndMobileTree(ctx) {
await ctx.step("workspace toggle stays put; the stage strip shares the workspace tab row", async () => {
    const spot = async (page, id) => { const box = await page.locator(id).boundingBox(); return [Math.round(box.x), Math.round(box.y)]; };
    const controlIds = (page) => page.locator("#workspace-controls button").evaluateAll((nodes) => nodes.map((node) => node.id));
    const h = await ctx.open({ terminals: [] });
    const { page } = h;
    await page.locator("#toggle-workspace").waitFor({ state: "visible" });
    assert.deepEqual(await controlIds(page), ["toggle-workspace"], "closed: the workspace toggle alone");
    assert.equal(await page.locator("#toggle-terminal").count(), 0);
    const home = await spot(page, "#toggle-workspace");
    const stageTop0 = (await page.locator("#desktop-stage").boundingBox()).y;
    await ctx.toggleWorkspace(page, true, "controls: expand");
    await page.locator(".pi-term .xterm").waitFor({ state: "visible" });
    assert.deepEqual(await controlIds(page), ["layout-presets", "toggle-workspace"], "open: presets precede the workspace toggle");
    assert.deepEqual(await spot(page, "#toggle-workspace"), home, "opening the workspace does not move the toggle");
    const shown = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const tabs = rect("#desktop-stage .dv-groupview:not(:has(.pi-chatcol)) .dv-tabs-and-actions-container");
      const mid = (box) => box.y + box.height / 2;
      const buttons = ["#new-terminal", "#toggle-tree"].map(rect);
      return { aligned: buttons.every((box) => Math.abs(mid(box) - mid(tabs)) <= 2), leftmostButton: Math.min(...buttons.map((box) => box.x)), controls: rect("#workspace-controls").x,
        lastTabRight: Math.max(...[...document.querySelectorAll(".dv-tab:has(.pi-tab)")].map((node) => node.getBoundingClientRect().right)) };
    });
    assert.equal(shown.aligned, true, "#new-terminal and #toggle-tree are vertically centred on the workspace tab row");
    assert.ok(shown.leftmostButton < shown.controls, "the stage strip sits left of the control group");
    assert.ok(shown.lastTabRight <= shown.leftmostButton, "no tab runs under the stage buttons");
    await page.locator("#toggle-tree").click();
    await ctx.openFile(page, "main.py");
    assert.deepEqual(await spot(page, "#toggle-workspace"), home, "opening a file moves nothing");
    await page.locator("#toggle-tree").click();
    await page.locator("#file-tree").waitFor({ state: "visible" });
    const popover = await page.locator("#file-tree").boundingBox();
    const tabRow = await page.locator("#desktop-stage .dv-groupview:not(:has(.pi-chatcol)) .dv-tabs-and-actions-container").boundingBox();
    assert.ok(popover.y >= tabRow.y + tabRow.height - 1, "the popover hangs below the tab row, clear of the buttons");
    await page.locator("#toggle-tree").click();
    await ctx.toggleWorkspace(page, false, "controls: collapse");
    assert.deepEqual(await spot(page, "#toggle-workspace"), home, "closing the workspace moves nothing");
    await assertUniqueIds(page, "controls");
    await ctx.finish(h, "controls", false);
    const peer = h;
    await ctx.restart(peer, {}, "m1");
    await peer.page.locator("#toggle-workspace").waitFor({ state: "visible" });
    assert.equal(await peer.page.locator("#toggle-workspace").isEnabled(), true);
    assert.deepEqual(await spot(peer.page, "#toggle-workspace"), home, "Every worker keeps the toggle in the same place");
    await ctx.finish(peer, "peer controls", false);
    const closed = h;
    await ctx.restart(closed, {}, "c1");
    assert.equal(await closed.page.locator("#toggle-workspace").isEnabled(), true);
    const stageTop = (await closed.page.locator("#desktop-stage").boundingBox()).y;
    const [closedX, closedY] = await spot(closed.page, "#toggle-workspace");
    assert.deepEqual([closedX, Math.round(closedY - stageTop)], [home[0], Math.round(home[1] - stageTop0)], "closed session: same place");
    await closed.page.locator("#toggle-workspace").click();
    await closed.page.locator("#file-tree").waitFor({ state: "visible" });
    assert.equal(await closed.page.locator("#new-terminal").count(), 0, "no terminal can start in a closed session: no new-terminal button");
    await ctx.finish(closed, "closed controls");
  });

await ctx.step("phone: one workspace overlay opening on a terminal tab, no bogus size", async () => {
    const h = await openMockWorkbench(ctx.browser, ctx.server.url, { fs: createMockFs(ctx.FILES), viewport: { width: 390, height: 844 }, mobile: true });
    ctx.openOnes.push(h.context);
    const { page, sockets } = h;
    await page.locator("#open-sidebar").click();
    await selectSession(page, "w1");
    await page.locator("#toggle-workspace").click();
    await page.locator(".pi-term .xterm").waitFor({ state: "visible" });
    assert.equal(await page.locator("#workspace-pane").evaluate((node) => getComputedStyle(node).position), "fixed", "the terminal opens inside the workspace overlay");
    assert.equal(await page.locator("#file-tree").isVisible(), false, "the terminal tab is shown, not the directory sheet");
    assert.equal(await page.locator('.dv-tab.dv-active-tab .pi-tab[data-kind="terminal"]').count(), 1, "the terminal tab is the active one");
    assert.equal(await page.locator("#toggle-terminal, #terminal-drawer-toggle, .pi-term-bar").count(), 0, "no terminal icon, no drawer, no second tab row on the phone");
    await page.locator('.pi-term .pi-term-view[data-status="connected"]').waitFor();
    await page.waitForTimeout(400);
    const sizes = () => sockets[0].received.filter((frame) => frame.type === "resize");
    assert.ok(sizes().length > 0 && sizes().every((frame) => frame.rows > 1 && frame.cols > 1), `the terminal only ever reports a real size (${JSON.stringify(sizes())})`);
    await page.locator(".pi-term .xterm").evaluate((node) => { node.dataset.mark = "kept"; });
    // the soft keyboard shrinks the layout viewport: the terminal follows it and stays on screen (simulated by resizing; a real Android keyboard was not exercised)
    await page.setViewportSize({ width: 390, height: 520 });
    await page.waitForTimeout(300);
    const screen = await page.locator(".pi-term .xterm-screen").boundingBox();
    assert.ok(screen.y >= 0 && screen.y + screen.height <= 520, "the whole terminal screen is inside the shrunk viewport");
    assert.equal(await page.locator(".pi-term .xterm").getAttribute("data-mark"), "kept", "xterm was not rebuilt");
    await page.setViewportSize({ width: 390, height: 844 });
    await assertUniqueIds(page, "phone terminal");
    await page.locator("#new-terminal").click();
    await page.locator('.pi-tab[data-shell="shell-2"]').waitFor();
    assert.equal(await page.locator('.dv-tab.dv-active-tab .pi-tab[data-shell="shell-2"]').count(), 1, "a new shell is the shown tab");
    await page.locator("#toggle-workspace").click();
    await page.waitForFunction(() => document.querySelector("#workspace-pane")?.hidden === true);
    await page.locator("#toggle-workspace").click();
    await page.locator(".pi-term .xterm").first().waitFor({ state: "attached" });
    assert.equal(await page.locator(".pi-term .xterm").first().getAttribute("data-mark"), "kept", "closing and reopening the overlay does not rebuild xterm");
    await ctx.finish(h, "phone terminal");
  });
}
