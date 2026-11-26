import type { Ghost } from "./ghost-types.ts";
import { prefersReducedMotion } from "../prefers-reduced-motion.ts";
import { cloneElement } from "./clone-element.ts";
import { readScrollOffsets } from "./read-scroll-offsets.ts";

/** Copy `node` as it is now (call before React hides or removes it) with its place. `drop`: root classes the copy must
 * not keep. `host`: the positioned ancestor to put the copy in when the node's own containing block goes away with it
 * (default: its offsetParent). Returns null when nothing is on screen. */
// Exception to the layout rule: the node is already leaving, so its exit copy must sit at the same place by measurement.
export function captureGhost(node: HTMLElement | null | undefined, drop: readonly string[] = [], host: HTMLElement | null = null): Ghost | null {
  if (!node?.isConnected || prefersReducedMotion() || node.hidden) return null;
  const container = host ?? node.offsetParent;
  const fixed = !container;
  const box = node.getBoundingClientRect();
  const base = host?.getBoundingClientRect();
  const rect = fixed ? box
    : host && base ? { left: box.left - base.left - host.clientLeft, top: box.top - base.top - host.clientTop, width: box.width, height: box.height }
      : { left: node.offsetLeft, top: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight };
  const clone = cloneElement(node);
  if (!rect.width || !rect.height || !clone) return null;
  const style = getComputedStyle(node);
  // The copy may lose its root class: keep the box's own look inline (the shadow moves with the same layer).
  const look = { backgroundColor: style.backgroundColor, border: style.border, borderRadius: style.borderRadius, boxShadow: style.boxShadow, backdropFilter: style.backdropFilter, color: style.color };
  return { clone, scrolls: readScrollOffsets(node), rect, fixed, parent: container ?? document.body, look, drop };
}
