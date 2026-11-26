import { safeText } from "../../../workbench/payloads/safe-text.js";
export function toolId(value: { toolCallId?: unknown; id?: unknown } | undefined, fallback: string): string {
  return safeText(value?.toolCallId) || safeText(value?.id) || fallback;
}
