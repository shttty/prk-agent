import { safeText } from "../../../workbench/payloads/safe-text.js";
export function messageId(message, index, entryId) {
  return safeText(entryId) || safeText(message?.id) || `history-${index}`;
}
