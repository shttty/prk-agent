import type { MessageStatus } from "../conversation-types.ts";
export function mergedStatus(left: MessageStatus | undefined, right: MessageStatus | undefined): MessageStatus | undefined {
  if (left?.type === "running" || right?.type === "running") return { type: "running" };
  if (left?.type === "incomplete") return left;
  if (right?.type === "incomplete") return right;
  return right || left;
}
