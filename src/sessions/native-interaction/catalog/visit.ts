import type { NativeCandidate } from "../native-types.ts";

type TreeNode = { entry: { id: string; type: string }; label?: string; children: readonly unknown[] };

/** Every tree entry in pre-order. Iterative: a long session is a chain thousands of entries deep, which overflows the call stack when walked recursively. */
export function visit(treeCandidates: NativeCandidate[], nodes: readonly TreeNode[]): void {
  const pending: TreeNode[] = [...nodes].reverse();
  for (let node = pending.pop(); node; node = pending.pop()) {
    treeCandidates.push({ value: node.entry.id, label: node.label ?? node.entry.type, description: node.entry.type, available: true });
    for (let index = node.children.length - 1; index >= 0; index--) pending.push(node.children[index] as TreeNode);
  }
}
