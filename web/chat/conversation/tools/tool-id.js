import { safeText } from "../../../workbench/payloads/safe-text.js";
export function toolId(value, fallback) {
  return safeText(value?.toolCallId) || safeText(value?.id) || fallback;
}
