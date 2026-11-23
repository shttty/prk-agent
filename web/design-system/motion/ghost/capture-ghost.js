import { prefersReducedMotion } from "../motion-token.js";

/** Copy `node` as it is now (call before React hides or removes it) with its place. `drop`: root classes the copy must
 * not keep (a class a selector expects to be unique). `host`: the positioned ancestor to put the copy in when the
 * node's own containing block goes away with it (default: its offsetParent). Returns null when nothing is on screen. */
export function captureGhost(node, drop = [], host = null) {
  if (!node?.isConnected || prefersReducedMotion() || node.hidden) return null;
  const fixed = !host && !node.offsetParent;
  const box = node.getBoundingClientRect();
  const base = host?.getBoundingClientRect();
  const rect = fixed ? box : host ? { left: box.left - base.left - host.clientLeft, top: box.top - base.top - host.clientTop, width: box.width, height: box.height } : { left: node.offsetLeft, top: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight };
  if (!rect.width || !rect.height) return null;
  const clone = node.cloneNode(true);
  // cloneNode copies attributes, not scroll offsets: keep what was in view.
  const scrolls = [node, ...node.querySelectorAll("*")].flatMap((item, index) => (item.scrollTop || item.scrollLeft ? [[index, item.scrollTop, item.scrollLeft]] : []));
  const parent = fixed ? document.body : host || node.offsetParent;
  const style = getComputedStyle(node);
  // The copy may lose its root class: keep the box's own look inline (the shadow moves with the same layer).
  const look = { backgroundColor: style.backgroundColor, border: style.border, borderRadius: style.borderRadius, boxShadow: style.boxShadow, backdropFilter: style.backdropFilter, color: style.color };
  return { clone, scrolls, rect, fixed, parent, look, drop };
}
