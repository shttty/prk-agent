import { safeText } from "../../workbench/payloads/safe-text.js";
export function likelyPlainText(value: unknown): boolean {
  return /^(?:!!?|\.\.?\/|~\/|[A-Za-z]:[\\/])/.test(safeText(value).trimStart());
}
