import { formatCount } from "./format-count.ts";
import type { ContextUsageFacts } from "./session-usage-types.ts";
export function contextText(usage: ContextUsageFacts | null | undefined) {
  if (!usage) return "SDK 还没有报告";
  const percent = typeof usage.percent === "number" && Number.isFinite(usage.percent) ? ` · ${usage.percent.toFixed(1)}%` : "";
  return `${formatCount(usage.tokens)} / ${formatCount(usage.contextWindow)} token${percent}`;
}
