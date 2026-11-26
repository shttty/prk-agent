import type { MessagePart } from "../conversation-types.ts";
export function hasRunningTool(content: readonly MessagePart[]) {
  return content.some((part) => part.type === "tool-call" && part.artifact?.running === true);
}
