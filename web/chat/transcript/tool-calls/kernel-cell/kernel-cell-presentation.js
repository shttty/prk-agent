import { contentText } from "../../../conversation/content-text.js";
import { sameCell } from "./same-cell.js";

export function kernelCellPresentation({ sessionId, toolCallId, delivery, active, checkpoint, finished }) {
  const identity = delivery || active || finished?.details || checkpoint?.details;
  const cell = identity && { ...identity, sessionId: identity.sessionId ?? sessionId };
  if (!cell || cell.sessionId !== sessionId || cell.toolCallId !== toolCallId
    || ![cell.sessionId, cell.kernelId, cell.cellId, cell.toolCallId].every((value) => typeof value === "string" && value)) return null;
  const live = sameCell(cell, active && { ...active, sessionId }) ? active : null;
  const saved = sameCell(cell, delivery && { ...delivery, sessionId }) ? delivery : null;
  const reminder = sameCell(cell, checkpoint?.details) ? checkpoint : null;
  const completion = sameCell(cell, finished?.details) ? finished : null;
  const outcome = completion?.details.outcome ?? saved?.outcome;
  const status = ["ok", "error", "aborted", "unknown"].includes(outcome) ? outcome : "running";
  const details = status === "running" ? live || reminder?.details || saved : completion?.details || saved;
  const finalText = completion?.outputPreview?.preview ?? contentText(Array.isArray(completion?.content) ? completion.content.slice(1) : completion?.content);
  const checkpointText = contentText(reminder?.content);
  return { ...cell, status, delivery: saved?.delivery || (status === "running" ? "running" : "unconfirmed"),
    output: status === "running" ? live?.output ?? checkpointText.slice(checkpointText.indexOf("\n") + 1) : finalText,
    elapsedMs: details?.elapsedMs ?? (saved?.finishedAt === undefined ? 0 : saved.finishedAt - cell.startedAt),
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
