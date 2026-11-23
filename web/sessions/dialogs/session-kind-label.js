
export function sessionKindLabel(node) {
  return node.lifecycle === "temporary" ? "临时" : "";
}
