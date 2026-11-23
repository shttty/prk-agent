import { Value } from "typebox/value";
import { projectAuthorityEntries } from "../../history/format-authority-entries.ts";
import type { DerivedSessionInfo } from "../../../plugins/sessions/session-types.ts";
import { RECEIPT_TYPE } from "../../../plugins/sessions/derivation-protocol.ts";
import { info } from "../metadata/read-info.ts";
import { save } from "../metadata/save-state.ts";
import type { DerivationContext } from "../derivation-state.ts";

export async function deliverResult(ctx: DerivationContext, sessionId: string, state: DerivedSessionInfo): Promise<void> {
  if (!state.result || !state.owner || state.phase === "delivered") return;
  const current = info(ctx, sessionId);
  if (!current || current.phase !== "submitted" || current.taskId !== state.taskId || current.result?.id !== state.result.id || current.owner !== state.owner) return;
  const destination = ctx.env.get(state.owner);
  const childId = ctx.env.get(sessionId).manager.getSessionId();
  const receipt = { child: childId, taskId: state.taskId, result: state.result, sessionId: destination.manager.getSessionId() };
  const exists = projectAuthorityEntries(destination.manager, ctx.schemas.limits).some((entry) => entry.type === "custom" && entry.customType === RECEIPT_TYPE
    && Value.Check(ctx.schemas.receiptSchema, entry.data) && entry.data.taskId === state.taskId && ctx.env.get(entry.data.child).manager.getSessionId() === childId
    && entry.data.sessionId === receipt.sessionId && entry.data.result.id === state.result!.id);
  if (!exists) destination.manager.appendCustomEntry(RECEIPT_TYPE, receipt);
  save(ctx, sessionId, { ...current, phase: "delivered" });
  ctx.env.publish(state.owner);
  if (exists) { if (current.lifecycle === "temporary") ctx.env.finishTemporarySession(sessionId); return; }
  try {
    await ctx.env.deliver(sessionId, state.owner,
      `[派生会话任务结果 / child=${childId} / task=${state.taskId} / result=${state.result.id}]\n${JSON.stringify({ child: childId, taskId: state.taskId, result: state.result })}`);
  } catch (error) {
    ctx.env.log(`Result ${state.result.id} has a receipt but its inbox admission failed; it will not be replayed.`, error);
  }
  if (current.lifecycle === "temporary") ctx.env.finishTemporarySession(sessionId);
}
