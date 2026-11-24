import type { DerivationContext } from "../derivation-state.ts";
import { info } from "../metadata/read-info.ts";
import type { OperationCompletionObserver } from "../../host/host-types.ts";

export async function notifyFailure(ctx: DerivationContext, sessionId: string, completion: Parameters<OperationCompletionObserver>[0], interruption: Parameters<OperationCompletionObserver>[1]): Promise<void> {
  if (completion.status === "completed" || ctx.closing.has(sessionId)) return;
  try {
    const child = info(ctx, sessionId);
    if (!child?.owner || child.result || child.owner === interruption.initiatorSessionId) return;
    const sessionName = ctx.env.get(sessionId).label;
    const fallback = completion.status === "unknown" ? "Execution outcome is unknown."
      : completion.status === "cancelled" ? "The run was cancelled." : "The run failed.";
    const text = (completion.error ?? interruption.reason ?? fallback).replace(/\s+/g, " ").trim() || fallback;
    const summary = text.length > 500 ? `${text.slice(0, 499).toWellFormed()}…` : text;
    await ctx.env.deliver(sessionId, child.owner, `[派生会话运行失败 / child=${sessionId}]\n${JSON.stringify({
      sessionId, sessionName, operationId: completion.operationId, type: completion.status, summary,
    })}`);
  } catch (error) {
    ctx.env.log(`Failure notification for derived operation ${completion.operationId} could not be admitted; it will not be replayed.`, error);
  }
}
