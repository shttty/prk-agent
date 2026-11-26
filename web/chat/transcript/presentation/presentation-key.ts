import { safeText } from "../../../workbench/payloads/safe-text.js";
export function presentationKey(sessionId: unknown, toolCallId: string) {
  return `${safeText(sessionId) || "session"}:${toolCallId}`;
}
