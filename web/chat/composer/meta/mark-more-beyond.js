/** Ref callback for a sideways-scrolling row: keeps `data-more="true"` on it while content lies beyond its right edge
 * (meta.css fades that edge). Written straight to the node, no React state, so scrolling never re-renders. */
export function markMoreBeyond(node) {
  if (!node) return undefined;
  const mark = () => { node.dataset.more = String(node.scrollLeft + node.clientWidth < node.scrollWidth - 1); };
  mark();
  const observer = new ResizeObserver(mark);
  observer.observe(node);
  for (const child of node.children) observer.observe(child);
  node.addEventListener("scroll", mark, { passive: true });
  return () => { observer.disconnect(); node.removeEventListener("scroll", mark); };
}
