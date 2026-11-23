import type { AgentSession, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { KernelCellIdentity, PythonToolClient } from "../../kernel/kernel-types.ts";
import type { KernelFinishedEventDetails } from "./cell-event-types.ts";
import { appendCellReceipt } from "../../sessions/history/kernel-cells/append-cell-receipt.ts";
import { readCellEntries } from "../../sessions/history/kernel-cells/read-cell-entries.ts";

export function bindCellEvents(pi: ExtensionAPI, session: AgentSession, client: PythonToolClient): () => void {
  let fence: object | undefined;
  let settlement: Promise<void> | undefined;
  let disposed = false;
  const trackRun = () => {
    const run = fence = {};
    settlement = session.waitForIdle().finally(() => { if (fence === run) settlement = undefined; });
  };
  if (!session.isIdle) trackRun();
  const offSession = session.subscribe((event) => { if (event.type === "agent_start") trackRun(); });

  // isIdle is true inside agent_settled; a fresh waitForIdle() there is too late.
  // Only unpublished PRK events wait here. Pi still owns all message dispatch and queues.
  const publish = (cell: KernelCellIdentity, entryId: string, send: (held: boolean) => void, release?: () => void) => {
    const sessionId = session.sessionId;
    const wait = session.isIdle ? settlement : undefined;
    const deliver = () => {
      try {
        if (disposed || client.handoffInProgress()) return;
        // Appends can move the leaf without losing this event's open or receipt.
        if (wait && (session.sessionId !== sessionId || !session.sessionManager.getBranch().some((entry) => entry.id === entryId))) return;
        send(wait !== undefined);
      } catch (error) {
        console.error(`[kernel] Cannot deliver event for ${cell.cellId}:`, error);
        client.interruptCell(cell.kernelId, cell.cellId, "notification");
      } finally { release?.(); }
    };
    if (wait) void wait.then(deliver, deliver);
    else deliver();
  };
  const offReminder = client.subscribeReminders((reminder) => {
    const cell = client.previewCell(reminder.cellId);
    if (!cell || cell.kernelId !== reminder.kernelId || cell.status !== "running") return;
    const entries = readCellEntries(session.sessionManager, cell.cellId).get(cell.cellId);
    if (!entries || entries.result || entries.open.kernelId !== cell.kernelId || entries.open.toolCallId !== cell.toolCallId
      || entries.open.startedAt !== cell.startedAt) return;
    const { output, ...identity } = cell;
    publish(cell, entries.openEntryId, (held) => {
      if (held) {
        // previewCell hides user-stopped cells but can still return a freezing or finished cell.
        const current = client.previewCell(cell.cellId);
        if (current?.status !== "running" || current.kernelId !== cell.kernelId || current.toolCallId !== cell.toolCallId
          || current.startedAt !== cell.startedAt) return;
      }
      pi.sendMessage({ customType: "kernel-event", display: true,
        content: `Cell ${cell.cellId} is running (checkpoint ${reminder.step}). No action is needed to continue. To stop it, call kernel_interrupt with this cell_id; do not poll.\n${output}`,
        details: { ...identity, eventId: `${cell.cellId}:checkpoint:${reminder.step}`, kind: "checkpoint", status: "running",
          sessionId: session.sessionId, step: reminder.step, nextInMs: reminder.nextInMs } }, { triggerTurn: true, deliverAs: "steer" });
    });
  });
  const offFinished = client.subscribeFinished((cell) => {
    let receiptId: string | undefined;
    try {
      receiptId = appendCellReceipt(session.sessionManager, cell);
    } catch (error) {
      cell.release();
      console.error(`[kernel] Failed to save cell ${cell.cellId} to session ${session.sessionId}:`, error);
      return;
    }
    if (!receiptId || disposed || client.handoffInProgress()) { cell.release(); return; }
    publish(cell, receiptId, () => {
      const stopped = cell.userStopped();
      const { result, cellId, kernelId, toolCallId, startedAt, finishedAt, elapsedMs, activeMs, imageCount, lateCallbacks, callbacksTruncated } = cell;
      const outcome = result.details.outcome;
      const { cause, affectedCells, initiatorCellId, suggestedMode } = result.details;
      const reason = result.details.reason ?? (stopped ? "Stopped by the user." : cell.reason);
      const details: KernelFinishedEventDetails = { eventId: `${cellId}:finished`, kind: "finished", status: "finished", sessionId: session.sessionId,
        cellId, kernelId, toolCallId, startedAt, finishedAt, elapsedMs, activeMs, imageCount, truncated: result.details.truncated,
        outcome, reason, lateCallbacks, callbacksTruncated, ...(cause === undefined ? {} : { cause, affectedCells, initiatorCellId }),
        ...(suggestedMode === undefined ? {} : { suggestedMode }) };
      const imagesNote = imageCount && !session.model?.input.includes("image")
        ? ` ${imageCount} retained image(s) are omitted from text-only model requests.` : "";
      pi.sendMessage({ customType: "kernel-event", display: true, details,
        content: [{ type: "text", text: `Cell ${cellId} finished: ${outcome}.${reason ? ` ${reason}` : ""}${imagesNote}` }, ...result.content] },
      stopped ? { triggerTurn: false } : { triggerTurn: true, deliverAs: "steer" });
    }, cell.release);
  });
  return () => { disposed = true; offSession(); offReminder(); offFinished(); };
}
