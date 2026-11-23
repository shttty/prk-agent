export function sameCell(left, right) {
  return Boolean(left && right && ["sessionId", "kernelId", "cellId", "toolCallId"].every((key) => typeof left[key] === "string" && left[key] && left[key] === right[key]));
}
