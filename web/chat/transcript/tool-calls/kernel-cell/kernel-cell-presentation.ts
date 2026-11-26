import { contentText } from "../../../conversation/content-text.ts";
import type { KernelCellDelivery } from "../../../../../src/gateway/wire/web-types.ts";
import { sameCell } from "./same-cell.ts";
import type { KernelEventMessage } from "./select-kernel-event.ts";

type ActiveCell = { toolCallId: string; kernelId: string; cellId: string; startedAt: number; language?: string; output?: string; waitingForAsk?: boolean; mode?: string; status?: string; elapsedMs?: number; activeMs?: number; truncated?: boolean; imageCount?: number };
type PresentationInput = { sessionId: string | null | undefined; toolCallId: string; delivery?: KernelCellDelivery | null; active?: ActiveCell | null; checkpoint?: KernelEventMessage; finished?: KernelEventMessage };
type CellIdentity = { sessionId?: string; kernelId?: string; cellId?: string; toolCallId?: string; startedAt?: number };

/** The kernel cell a tool row shows: the saved delivery, the live cell, or the Gateway's kernel-event messages. */
export function kernelCellPresentation({ sessionId, toolCallId, delivery, active, checkpoint, finished }: PresentationInput) {
  if (typeof sessionId !== "string") return null;
  const identity: CellIdentity | undefined = delivery || active || finished?.details || checkpoint?.details || undefined;
  const cell = identity && { ...identity, sessionId: identity.sessionId ?? sessionId };
  if (!cell || cell.sessionId !== sessionId || cell.toolCallId !== toolCallId
    || ![cell.sessionId, cell.kernelId, cell.cellId, cell.toolCallId].every((value) => typeof value === "string" && value)) return null;
  const { kernelId = "", cellId = "" } = cell;
  const live = sameCell(cell, active && { ...active, sessionId }) ? active : null;
  const saved = sameCell(cell, delivery && { ...delivery, sessionId }) ? delivery : null;
  const reminder = sameCell(cell, checkpoint?.details) ? checkpoint : null;
  const completion = sameCell(cell, finished?.details) ? finished : null;
  const outcome = completion?.details.outcome ?? saved?.outcome;
  const status = outcome === "ok" || outcome === "error" || outcome === "aborted" || outcome === "unknown" ? outcome : "running";
  const details: { elapsedMs?: number; activeMs?: number; truncated?: boolean; imageCount?: number } | null | undefined = status === "running" ? live || reminder?.details || saved : completion?.details || saved;
  const finalText = completion?.outputPreview?.preview ?? contentText(Array.isArray(completion?.content) ? completion.content.slice(1) : completion?.content);
  const checkpointText = contentText(reminder?.content);
  return { ...cell, sessionId, kernelId, cellId, toolCallId, status, delivery: saved?.delivery || (status === "running" ? "running" : "unconfirmed"),
    output: status === "running" ? live?.output ?? checkpointText.slice(checkpointText.indexOf("\n") + 1) : finalText,
    elapsedMs: details?.elapsedMs ?? (saved?.finishedAt === undefined ? 0 : saved.finishedAt - (cell.startedAt ?? 0)),
    activeMs: details?.activeMs, finishedAt: completion?.details.finishedAt ?? saved?.finishedAt,
    waitingForAsk: status === "running" && live?.waitingForAsk === true,
    // Language is the cell's own (admission time); it is never filled from the session's current choice.
    language: saved?.language ?? live?.language, mode: live?.mode,
    stopping: status === "running" && live?.status === "stopping",
    truncated: details?.truncated === true, imageCount: details?.imageCount ?? 0,
    reason: completion?.details.reason ?? saved?.reason, notice: saved?.notice,
    checkpoint: reminder?.details ?? saved?.lastCheckpoint,
  };
}

export type KernelCellView = NonNullable<ReturnType<typeof kernelCellPresentation>>;
