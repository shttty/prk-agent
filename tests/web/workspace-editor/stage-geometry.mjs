// Stage geometry shared by the workspace editor steps: visible card boxes, a 1.5px tolerance, and a handle drag.
import assert from "node:assert/strict";

export const boxes = (page) => page.evaluate(() => {
  const box = (node) => {
    if (!node || node.closest("[hidden]") || !node.checkVisibility({ visibilityProperty: true })) return null;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? { left: rect.left, right: rect.right, width: rect.width, top: rect.top, bottom: rect.bottom, height: rect.height } : null;
  };
  const get = (selector) => box(document.querySelector(selector));
  const expand = get("#toggle-tree");
  const hit = expand && document.elementFromPoint(expand.left + expand.width / 2, expand.top + expand.height / 2);
  return { window: innerWidth, side: get(".desktop-sidebar"), stage: get("#desktop-stage"), grid: get(".pi-stage-grid"), chat: get(".pi-chatcol"),
    work: [...document.querySelectorAll("#desktop-stage .dv-groupview:not(:has(.pi-chatcol))")].map(box).filter(Boolean),
    tree: get('#file-tree[data-mode="pinned"]'), treeChild: document.querySelector("#file-tree")?.parentElement?.id === "desktop-stage", expand, expandHit: Boolean(hit?.closest("#toggle-tree")) };
});
export const near = (a, b, label) => assert.ok(Math.abs(a - b) <= 1.5, `${label} (${Math.round(a)} vs ${Math.round(b)})`);
export const dragBy = async (page, selector, dx) => {
  const handle = await page.locator(selector).boundingBox();
  const x = handle.x + handle.width / 2;
  const y = handle.y + Math.min(300, handle.height / 2);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(Math.max(1, Math.min(page.viewportSize().width - 1, x + dx)), y, { steps: 6 });
  await page.mouse.up();
};
