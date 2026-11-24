import { findPresentationAnchor } from "./presentation/find-presentation-anchor.js";

export function revealMessage(viewport, messageId, { offset, openDetails, prepare } = {}) {
  const row = viewport && findPresentationAnchor(viewport, { key: messageId });
  if (!row) return false;
  const target = prepare ? prepare(row) : row;
  if (!target) return false;
  if (openDetails) for (const details of row.querySelectorAll("details")) details.open = true;
  const rect = target.getBoundingClientRect();
  const alignment = offset ?? (viewport.clientHeight - rect.height) / 2;
  viewport.scrollTop += rect.top - viewport.getBoundingClientRect().top - alignment;
  return true;
}
