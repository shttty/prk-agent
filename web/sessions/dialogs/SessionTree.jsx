import { MAX_TREE_DEPTH } from "../sidebar/sidebar-constants.js";
import "./dialogs.css";
/** Tree of sessions linked by `owner`: under `root`, or (no `root`) one tree per node whose owner is outside `nodes`; used by the archive previews. */
export function SessionTree({ nodes, root, renderNode }) {
  const byOwner = new Map();
  for (const node of nodes) if (node.sessionId !== root && node.owner) byOwner.set(node.owner, [...(byOwner.get(node.owner) || []), node]);
  const branch = (node, depth) => {
    const children = depth < MAX_TREE_DEPTH ? byOwner.get(node.sessionId) || [] : [];
    return <li key={node.sessionId}>{renderNode(node)}{children.length > 0 && <ul>{children.map((child) => branch(child, depth + 1))}</ul>}</li>;
  };
  const known = new Set(nodes.map((node) => node.sessionId));
  const tops = root ? nodes.filter((node) => node.sessionId === root) : nodes.filter((node) => !known.has(node.owner));
  return tops.length ? <ul className="management-affected-tree">{tops.map((top) => branch(top, 0))}</ul> : null;
}
