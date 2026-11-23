
export function hasRunningTool(content) {
  return Array.isArray(content) && content.some((part) => part?.type === "tool-call" && part.artifact?.running === true);
}
