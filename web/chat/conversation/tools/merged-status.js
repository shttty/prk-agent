
export function mergedStatus(left, right) {
  if (left?.type === "running" || right?.type === "running") return { type: "running" };
  if (left?.type === "incomplete") return left;
  if (right?.type === "incomplete") return right;
  return right || left;
}
