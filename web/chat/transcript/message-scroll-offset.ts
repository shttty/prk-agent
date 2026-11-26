import type { RevealOptions } from "./scroll-types.ts";
import { findPresentationAnchor } from "./presentation/find-presentation-anchor.ts";

/** Scroll offset that centres (or places at `offset`) the message row; undefined when it is not mounted, null when `prepare` refuses it. */
export function messageScrollOffset(viewport: HTMLElement | null, messageId: string, { offset, openDetails, prepare }: RevealOptions = {}): number | null | undefined {
  const row = viewport && findPresentationAnchor(viewport, { key: messageId });
  if (!viewport || !row) return undefined;
  const target = prepare ? prepare(row) : row;
  if (!target) return null;
  if (openDetails) for (const details of row.querySelectorAll("details")) details.open = true;
  const rect = target.getBoundingClientRect();
  const alignment = offset ?? (viewport.clientHeight - rect.height) / 2;
  return viewport.scrollTop + rect.top - viewport.getBoundingClientRect().top - alignment;
}
