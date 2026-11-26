import { isPayload } from "../../../payload/is-payload.ts";
import { sameCell } from "./same-cell.ts";

/** A kernel-event custom message (checkpoint or finished) as the Gateway writes it. */
export type KernelEventMessage = {
  content?: unknown;
  outputPreview?: { preview?: string };
  details: { sessionId: string; kernelId?: string; cellId: string; toolCallId: string; kind: string; eventId: string; step?: number; startedAt?: number; outcome?: string; finishedAt?: number; reason?: string; elapsedMs?: number; activeMs?: number; truncated?: boolean; imageCount?: number };
};

function isKernelEventMessage(message: unknown): message is KernelEventMessage {
  return isPayload(message) && message.role === "custom" && message.customType === "kernel-event" && isPayload(message.details)
    && ["sessionId", "cellId", "toolCallId", "kind", "eventId"].every((key) => isPayload(message.details) && typeof message.details[key] === "string");
}

export function selectKernelEvent(messages: readonly unknown[] | undefined, sessionId: string, toolCallId: string, kind: "checkpoint" | "finished", identity: object | null | undefined): KernelEventMessage | undefined {
  return messages?.findLast((message): message is KernelEventMessage => isKernelEventMessage(message)
    && message.details.sessionId === sessionId && message.details.toolCallId === toolCallId && message.details.kind === kind
    && message.details.eventId === `${message.details.cellId}:${kind === "finished" ? "finished" : `checkpoint:${message.details.step}`}`
    && (!identity || sameCell({ ...identity, sessionId }, message.details)));
}
