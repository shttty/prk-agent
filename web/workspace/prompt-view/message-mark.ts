import type { PromptDiff } from "../../../src/gateway/wire/web-types.ts";

/** How message `index` stands against the previous request: new at the end, or the place where the shared prefix breaks. */
export function messageMark(change: PromptDiff["messages"] | undefined, index: number): "新增" | "前缀断开" | null {
  if (!change) return null;
  if (!change.prefixStable && index === change.commonPrefix) return "前缀断开";
  return index >= change.before ? "新增" : null;
}
