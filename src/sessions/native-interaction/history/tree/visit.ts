import type { NativeTreeContext } from "../../native-types.ts";

export function visit(ctx: NativeTreeContext, nodes: readonly { entry: { id: string; type: string }; label?: string; children: readonly unknown[] }[], depth: number): readonly Record<string, unknown>[] {
  if (depth > ctx.limits.nativeTreeDepth || ctx.remaining <= 0) return [];
  const output: Record<string, unknown>[] = [];
  for (const node of nodes) {
    // Never post-decrement past zero: a -1 budget would let sibling subtrees bypass the node cap.
    if (ctx.remaining <= 0) break;
    ctx.remaining--;
    output.push({ id: node.entry.id, type: node.entry.type, ...(node.label === undefined ? {} : { label: node.label }), children: visit(ctx, node.children as typeof nodes, depth + 1) });
  }
  return output;
}
