import type { NativeCandidate } from "../native-types.ts";

export function visit(treeCandidates: NativeCandidate[], nodes: readonly { entry: { id: string; type: string }; label?: string; children: readonly unknown[] }[]): void {
  for (const node of nodes) {
    treeCandidates.push({ value: node.entry.id, label: node.label ?? node.entry.type, description: node.entry.type, available: true });
    visit(treeCandidates, node.children as typeof nodes);
  }
}
