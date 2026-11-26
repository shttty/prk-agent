import type { Extent, Extents } from "./grid-types.ts";

const moved = (a: Extent | undefined, b: Extent | undefined) => !a || !b || Math.abs(a.width - b.width) > 1 || Math.abs(a.height - b.height) > 1;

/** The groups' preferred sizes after a layout change that was not a squeeze of the stage (a handle drag, a drop, a
 * group added or closed): a group whose size differs from how it was last laid out (`laid`), or that is new, prefers
 * its size now (`current`); any other keeps its preference, also while it is squeezed. The main area (`main`: its
 * group id) has none: it takes what the others leave. All maps: group id -> `{ width, height }`. Pure. */
export function updatePreferred(preferred: Extents, laid: Extents, current: Extents, main: string | null | undefined) {
  const next: Extents = {};
  for (const [id, size] of Object.entries(current)) {
    if (id === main) continue;
    next[id] = !preferred[id] || moved(laid[id], size) ? size : preferred[id];
  }
  return next;
}
