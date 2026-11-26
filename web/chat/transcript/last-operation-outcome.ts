import { safeText } from "../../workbench/payloads/safe-text.js";
import type { OperationCompletion } from "../../../src/gateway/wire/web-types.ts";
/**
 * Outcome of the most recent operation when it did not complete normally. SDK user
 * messages carry no request identity, so the outcome sits at the end of the
 * transcript (where that operation ended) instead of being pinned to a guessed message.
 */
export function lastOperationOutcome({ operation, recentOperations }: { operation?: unknown; recentOperations?: readonly OperationCompletion[] }, busy: boolean): { status: string; text: string } | null {
  if (busy || operation) return null;
  const last = recentOperations?.at(-1);
  if (!last || last.status === "completed") return null;
  const status = safeText(last.status);
  const text = status === "cancelled" || status === "canceled" ? "已停止。"
    : status === "unknown" ? `结果未知${last.error ? `：${safeText(last.error)}` : "：执行端未确认结果。"}`
      : last.kind === "compact" ? `压缩失败${last.error ? `：${safeText(last.error)}` : "。"}`
      : safeText(last.error) || "执行失败。";
  return { status, text };
}
