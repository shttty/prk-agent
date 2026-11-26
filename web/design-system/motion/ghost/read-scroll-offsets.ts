import type { ScrollOffset } from "./ghost-types.ts";

/** cloneNode copies attributes, not scroll offsets: record what was in view. */
export function readScrollOffsets(root: HTMLElement): ScrollOffset[] {
  return [root, ...root.querySelectorAll("*")].flatMap((item, index) => (item.scrollTop || item.scrollLeft ? [[index, item.scrollTop, item.scrollLeft] as const] : []));
}
