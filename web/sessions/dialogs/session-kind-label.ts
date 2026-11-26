export function sessionKindLabel(node: { lifecycle?: string }): string {
  return node.lifecycle === "temporary" ? "临时" : "";
}
