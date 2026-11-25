import type { KernelFailure } from "../../../kernel/kernel-types.ts";
import type { OperationCompletionObserver } from "../../host/host-types.ts";
import type { DerivationContext } from "../derivation-state.ts";
import { info } from "../metadata/read-info.ts";

export async function notifyFailure(ctx: DerivationContext, sessionId: string,
  failure: Parameters<OperationCompletionObserver>[0] | KernelFailure, interruption?: Parameters<OperationCompletionObserver>[1]): Promise<void> {
  const kernel = "kernelId" in failure;
  if (ctx.closing.has(sessionId) || (!kernel && failure.status === "completed")) return;
  try {
    const child = info(ctx, sessionId);
    if (!child?.owner || child.result || child.owner === interruption?.initiatorSessionId) return;
    const sessionName = ctx.env.get(sessionId).label;
    const fallback = kernel ? "The kernel became unavailable."
      : failure.status === "unknown" ? "Execution outcome is unknown."
      : failure.status === "cancelled" ? "The run was cancelled." : "The run failed.";
    const reason = kernel ? failure.reason : failure.error ?? interruption?.reason;
    const text = (reason instanceof Error ? reason.message : String(reason ?? fallback)).replace(/\s+/g, " ").trim() || fallback;
    const summary = text.length > 500 ? `${text.slice(0, 499).toWellFormed()}…` : text;
    const detail = kernel ? { kernelId: failure.kernelId, kernelState: failure.state, type: "failed" }
      : { operationId: failure.operationId, type: failure.status };
    await ctx.env.deliver(sessionId, child.owner, `[派生会话运行失败 / child=${sessionId}]\n${JSON.stringify({ sessionId, sessionName, ...detail, summary })}`);
  } catch (error) {
    const subject = kernel ? `kernel ${failure.kernelId}` : `operation ${failure.operationId}`;
    ctx.env.log(`Failure notification for derived ${subject} could not be admitted; it will not be replayed.`, error);
  }
}
