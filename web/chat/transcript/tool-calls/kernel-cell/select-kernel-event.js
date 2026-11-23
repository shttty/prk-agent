import { sameCell } from "./same-cell.js";

export function selectKernelEvent(messages, sessionId, toolCallId, kind, identity) {
  return messages?.findLast((message) => message?.role === "custom" && message.customType === "kernel-event"
    && message.details?.sessionId === sessionId && message.details.toolCallId === toolCallId && message.details.kind === kind
    && message.details.eventId === `${message.details.cellId}:${kind === "finished" ? "finished" : `checkpoint:${message.details.step}`}`
    && (!identity || sameCell({ ...identity, sessionId }, message.details)));
}
