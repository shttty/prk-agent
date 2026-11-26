export function findPresentationAnchor(viewport: Element, anchor: { key?: string } | null | undefined): HTMLElement | null {
  if (!anchor?.key) return null;
  const escaped = globalThis.CSS?.escape ? globalThis.CSS.escape(anchor.key) : anchor.key.replaceAll('"', '\\"');
  return viewport.querySelector<HTMLElement>(`[data-message-id="${escaped}"]`);
}
