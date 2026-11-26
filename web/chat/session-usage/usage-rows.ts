import { contextText } from "./context-text.ts";
import { formatCost } from "./format-cost.ts";
import { formatCount as count } from "./format-count.ts";
import type { ContextUsageFacts, SessionStats, UsageRow } from "./session-usage-types.ts";

/** Rows for a `<dl>`: context, messages, cumulative tokens and cost, as the SDK reports them. */
export function usageRows(stats: SessionStats | null | undefined, contextUsage: ContextUsageFacts | null | undefined): UsageRow[] {
  const rows: UsageRow[] = [["context", "上下文", contextText(contextUsage || stats?.contextUsage)]];
  if (stats && Number.isFinite(stats.totalMessages)) {
    rows.push(["messages", "消息", `${count(stats.totalMessages)} 条 · 你 ${count(stats.userMessages)} · 助手 ${count(stats.assistantMessages)} · 工具调用 ${count(stats.toolCalls)}`]);
  } else if (stats && Number.isFinite(stats.messageCount)) {
    rows.push(["messages", "消息", `${count(stats.messageCount)} 条 · 只读历史没有 token 统计`]);
  }
  const tokens = stats?.tokens;
  if (tokens && typeof tokens === "object") {
    rows.push(["cumulative-tokens", "累计 token", count(tokens.total)]);
    rows.push(["token-breakdown", "明细", `输入 ${count(tokens.input)} · 输出 ${count(tokens.output)} · 缓存读 ${count(tokens.cacheRead)} · 缓存写 ${count(tokens.cacheWrite)}`]);
  }
  if (stats && Number.isFinite(stats.cost)) rows.push(["cost", "费用", formatCost(stats.cost)]);
  return rows;
}
