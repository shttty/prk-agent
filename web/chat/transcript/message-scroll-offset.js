import { findPresentationAnchor } from "./presentation/find-presentation-anchor.js";

export function messageScrollOffset(viewport, messageId, { offset, openDetails, prepare } = {}) {
  const row = viewport && findPresentationAnchor(viewport, { key: messageId });
  if (!row) return undefined;
  const target = prepare ? prepare(row) : row;
  if (!target) return null;
  if (openDetails) for (const details of row.querySelectorAll("details")) details.open = true;
  const rect = target.getBoundingClientRect();
  const alignment = offset ?? (viewport.clientHeight - rect.height) / 2;
  return viewport.scrollTop + rect.top - viewport.getBoundingClientRect().top - alignment;
}
