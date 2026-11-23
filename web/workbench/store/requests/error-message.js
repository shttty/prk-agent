import { isRecord } from "../../payloads/is-record.js";
import { safeText } from "../../payloads/safe-text.js";
export function errorMessage(body, status) {
  if (isRecord(body?.error)) {
    const message = safeText(body.error.message);
    if (message) return message;
  }
  return safeText(body?.message) || safeText(body?.error) || `请求失败（HTTP ${status}）。`;
}

