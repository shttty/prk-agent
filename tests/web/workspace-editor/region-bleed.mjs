/**
 * Region containment: session sidebar, chat card, each workspace group card, directory and terminal stay inside
 * their own boxes. Two checks over the regions that are on screen:
 *  - natural: points inside a region's rectangle hit an element of that region (or the control group / expand button);
 *  - probe: a huge z-index:99999 box dropped into a region's clipping element must not be hit anywhere in another,
 *    non-nested region (this proves the clip + stacking context, whatever content happens to overflow today).
 * pointer-events:none decoration (Select chevrons) is made hittable first. Returns the failures.
 */
export const REGIONS = [
  { name: "session sidebar", box: ".desktop-sidebar", probe: ".desktop-sidebar" },
  { name: "chat column", box: ".pi-chatcol", probe: ".pi-chatcol" },
  { name: "workspace card", box: "#desktop-stage .dv-groupview:not(:has(.pi-chatcol))", probe: null },
  { name: "directory tree", box: "#file-tree", probe: "#file-tree .pi-files" },
  { name: "terminal panel", box: ".pi-term", probe: ".pi-term" },
];
export async function regionBleed(page) {
  await page.addStyleTag({ content: ".pi-chatcol *, .desktop-sidebar *, #desktop-stage * { pointer-events: auto !important; }" });
  return page.evaluate((regions) => {
    const live = regions.flatMap((region) => [...document.querySelectorAll(region.box)].map((box, index) => {
      const rect = box?.getBoundingClientRect();
      // (a dock tab hidden behind another keeps its box but is not painted)
      return box && rect.width > 8 && rect.height > 8 && getComputedStyle(box).display !== "none" && box.checkVisibility({ visibilityProperty: true }) ? { ...region, name: `${region.name} ${index}`, node: box, rect } : null;
    })).filter(Boolean);
    const points = (rect) => {
      const inset = Math.min(12, rect.width / 4, rect.height / 4);
      const out = [];
      for (let i = 0; i < 7; i += 1) for (let j = 0; j < 7; j += 1) out.push([rect.x + inset + ((rect.width - 2 * inset) * i) / 6, rect.y + inset + ((rect.height - 2 * inset) * j) / 6]);
      return out;
    };
    const failures = [];
    const allowed = (hit) => hit?.closest("#workspace-controls, .pi-float-left, .pi-splitter, .pi-stage-strip");
    for (const region of live) {
      for (const [x, y] of points(region.rect)) {
        const hit = document.elementFromPoint(x, y);
        if (hit && !region.node.contains(hit) && !allowed(hit)) { failures.push(`natural: ${region.name} at ${Math.round(x)},${Math.round(y)} hit ${hit?.tagName}.${String(hit?.className).slice(0, 40)}`); break; }
      }
    }
    for (const region of live) {
      const parent = region.probe ? region.node.matches(region.probe) ? region.node : region.node.querySelector(region.probe) : region.node;
      const probe = document.createElement("div");
      probe.dataset.regionProbe = "1";
      probe.style.cssText = "position:relative;z-index:99999;flex:none;width:6000px;height:6000px;margin:-3000px 0 0 -3000px;background:red;pointer-events:auto";
      parent.append(probe);
      for (const other of live) {
        if (other === region || other.node.contains(region.node) || region.node.contains(other.node)) continue;
        for (const [x, y] of points(other.rect)) {
          const hit = document.elementFromPoint(x, y);
          if (hit?.closest("[data-region-probe]")) { failures.push(`probe: ${region.name} paints over ${other.name} at ${Math.round(x)},${Math.round(y)}`); break; }
        }
      }
      probe.remove();
    }
    return failures;
  }, REGIONS);
}
