import { number } from "./usage-rows.js";
export function contextText(usage) {
  if (!usage) return "SDK 还没有报告";
  const percent = Number.isFinite(usage.percent) ? ` · ${usage.percent.toFixed(1)}%` : "";
  return `${number(usage.tokens)} / ${number(usage.contextWindow)} token${percent}`;
}
