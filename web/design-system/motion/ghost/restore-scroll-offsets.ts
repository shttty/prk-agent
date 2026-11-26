import type { ScrollOffset } from "./ghost-types.ts";

export function restoreScrollOffsets(root: HTMLElement, scrolls: readonly ScrollOffset[]): void {
  const nodes = [root, ...root.querySelectorAll("*")];
  for (const [index, top, left] of scrolls) {
    const node = nodes[index];
    if (!node) continue;
    node.scrollTop = top;
    node.scrollLeft = left;
  }
}
