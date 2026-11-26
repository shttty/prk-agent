import { isRecord } from "../../payloads/is-record.ts";
import { safeText } from "../../payloads/safe-text.ts";

export function errorMessage(body: unknown, status: number): string {
  if (isRecord(body)) {
    if (isRecord(body.error)) {
      const message = safeText(body.error.message);
      if (message) return message;
    }
    const text = safeText(body.message) || safeText(body.error);
    if (text) return text;
  }
  return `请求失败（HTTP ${status}）。`;
}
