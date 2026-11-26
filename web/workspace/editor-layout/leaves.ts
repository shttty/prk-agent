import type { SavedGroup } from "./editor-layout-types.ts";
import { isRecord } from "./is-record.ts";

/** The group leaves of a saved grid tree, or null when the tree is malformed. The input is parsed JSON: each leaf's own
 * fields are validated by parseSavedLayout, which is the only caller outside this file. */
export function leaves(node: unknown): SavedGroup[] | null {
  if (!isRecord(node)) return null;
  // External input boundary: saved layout JSON; parseSavedLayout validates the group fields.
  if (node.type === "leaf") return isRecord(node.data) ? [node.data as unknown as SavedGroup] : null;
  if (node.type !== "branch" || !Array.isArray(node.data) || !node.data.length) return null;
  const out: SavedGroup[] = [];
  for (const child of node.data) {
    const found = leaves(child);
    if (!found) return null;
    out.push(...found);
  }
  return out;
}
