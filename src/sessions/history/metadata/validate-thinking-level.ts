import type { PersistedThinkingLevel } from "../history-types.ts";

export function thinkingLevel(value: unknown): value is PersistedThinkingLevel {
  return value === "off" || value === "minimal" || value === "low" || value === "medium"
    || value === "high" || value === "xhigh" || value === "max";
}
