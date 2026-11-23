import { contextText } from "./context-text.js";
// Session usage as reported by the SDK (`session` native action and snapshot contextUsage).
// Nothing here is estimated: a missing number renders as "—".

export const number = (value) => (Number.isFinite(value) ? value.toLocaleString("zh-CN") : "—");

export function formatCost(value) {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toFixed(value > 0 && value < 1 ? 4 : 2)}`;
}

/** Rows for a `<dl>`: context, messages, cumulative tokens and cost. */
export function usageRows(stats, contextUsage) {
  const rows = [["context", "上下文", contextText(contextUsage || stats?.contextUsage)]];
  if (stats && Number.isFinite(stats.totalMessages)) {
    rows.push(["messages", "消息", `${number(stats.totalMessages)} 条 · 你 ${number(stats.userMessages)} · 助手 ${number(stats.assistantMessages)} · 工具调用 ${number(stats.toolCalls)}`]);
  } else if (stats && Number.isFinite(stats.messageCount)) {
    rows.push(["messages", "消息", `${number(stats.messageCount)} 条 · 只读历史没有 token 统计`]);
  }
  const tokens = stats?.tokens;
  if (tokens && typeof tokens === "object") {
    rows.push(["cumulative-tokens", "累计 token", number(tokens.total)]);
    rows.push(["token-breakdown", "明细", `输入 ${number(tokens.input)} · 输出 ${number(tokens.output)} · 缓存读 ${number(tokens.cacheRead)} · 缓存写 ${number(tokens.cacheWrite)}`]);
  }
  if (stats && Number.isFinite(stats.cost)) rows.push(["cost", "费用", formatCost(stats.cost)]);
  return rows;
}
