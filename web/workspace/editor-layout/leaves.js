import { isRecord } from "./is-record.js";
export function leaves(node) {
  if (!isRecord(node)) return null;
  if (node.type === "leaf") return isRecord(node.data) ? [node.data] : null;
  if (node.type !== "branch" || !Array.isArray(node.data) || !node.data.length) return null;
  const out = [];
  for (const child of node.data) {
    const found = leaves(child);
    if (!found) return null;
    out.push(...found);
  }
  return out;
}
