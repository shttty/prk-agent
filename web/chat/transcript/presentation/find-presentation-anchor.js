
export function findPresentationAnchor(viewport, anchor) {
  if (!anchor?.key) return null;
  const escaped = globalThis.CSS?.escape ? globalThis.CSS.escape(anchor.key) : anchor.key.replaceAll('"', '\\"');
  return viewport.querySelector(`[data-message-id="${escaped}"]`);
}
