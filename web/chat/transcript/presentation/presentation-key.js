import { safeText } from "../../../workbench/payloads/safe-text.js";
export function presentationKey(sessionId, toolCallId) {
  return `${safeText(sessionId) || "session"}:${toolCallId}`;
}
