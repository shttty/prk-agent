/** A deep copy of `node`; cloneNode is typed as a plain Node. */
export function cloneElement(node: HTMLElement): HTMLElement | null {
  const clone = node.cloneNode(true);
  return clone instanceof HTMLElement ? clone : null;
}
