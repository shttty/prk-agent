import { safeText } from "../../../workbench/payloads/safe-text.js";
export function messageId(message: { id?: unknown } | undefined, index: number, entryId?: string | null) {
  return safeText(entryId) || safeText(message?.id) || `history-${index}`;
}
