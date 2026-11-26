import type { ReactNode } from "react";
import { MAX_TREE_DEPTH } from "../sidebar/sidebar-constants.ts";
import "./dialogs.css";

type TreeNode = { sessionId: string; owner?: string | null };
type SessionTreeProps<Node extends TreeNode> = { nodes: readonly Node[]; root?: string; renderNode: (node: Node) => ReactNode };

/** Tree of sessions linked by `owner`: under `root`, or (no `root`) one tree per node whose owner is outside `nodes`; used by the archive previews. */
export function SessionTree<Node extends TreeNode>({ nodes, root, renderNode }: SessionTreeProps<Node>) {
  const byOwner = new Map<string, Node[]>();
  for (const node of nodes) if (node.sessionId !== root && node.owner) byOwner.set(node.owner, [...(byOwner.get(node.owner) || []), node]);
  const branch = (node: Node, depth: number): ReactNode => {
    const children = depth < MAX_TREE_DEPTH ? byOwner.get(node.sessionId) || [] : [];
    return <li key={node.sessionId}>{renderNode(node)}{children.length > 0 && <ul>{children.map((child) => branch(child, depth + 1))}</ul>}</li>;
  };
  const known = new Set(nodes.map((node) => node.sessionId));
  const tops = root ? nodes.filter((node) => node.sessionId === root) : nodes.filter((node) => !node.owner || !known.has(node.owner));
  return tops.length ? <ul className="management-affected-tree">{tops.map((top) => branch(top, 0))}</ul> : null;
}
