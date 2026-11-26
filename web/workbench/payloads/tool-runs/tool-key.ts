import { safeText } from "../safe-text.ts";

export function toolKey(details: Record<string, unknown>, sessionId: string | null | undefined, operationId: string | undefined): string {
  const callId = safeText(details.toolCallId) || safeText(details.id);
  if (callId) return `${sessionId || "session"}:${callId}`;
  const operation = safeText(operationId) || "unscoped";
  const toolName = safeText(details.toolName) || "tool";
  return `${sessionId || "session"}:operation:${operation}:${toolName}`;
}
