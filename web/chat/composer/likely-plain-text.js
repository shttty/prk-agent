import { safeText } from "../../workbench/payloads/safe-text.js";
export function likelyPlainText(value) {
  return /^(?:!!?|\.\.?\/|~\/|[A-Za-z]:[\\/])/.test(safeText(value).trimStart());
}
