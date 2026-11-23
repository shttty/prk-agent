import { safeText } from "../safe-text.js";
export function toolKey(details, sessionId, operationId) {
  const callId = safeText(details?.toolCallId) || safeText(details?.id);
  if (callId) return `${sessionId || "session"}:${callId}`;
  const operation = safeText(operationId) || "unscoped";
  const toolName = safeText(details?.toolName) || "tool";
  return `${sessionId || "session"}:operation:${operation}:${toolName}`;
}

