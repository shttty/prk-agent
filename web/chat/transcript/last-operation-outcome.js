import { safeText } from "../../workbench/payloads/safe-text.js";
/**
 * Outcome of the most recent operation when it did not complete normally. SDK user
 * messages carry no request identity, so the outcome sits at the end of the
 * transcript (where that operation ended) instead of being pinned to a guessed message.
 */
export function lastOperationOutcome({ operation, recentOperations }, busy) {
  if (busy || operation) return null;
  const recent = recentOperations;
  const last = Array.isArray(recent) ? recent.at(-1) : null;
  if (!last || last.status === "completed") return null;
  const status = safeText(last.status);
  const text = status === "cancelled" || status === "canceled" ? "已停止。"
    : status === "unknown" ? `结果未知${last.error ? `：${safeText(last.error)}` : "：执行端未确认结果。"}`
      : safeText(last.error) || "执行失败。";
  return { status, text };
}
