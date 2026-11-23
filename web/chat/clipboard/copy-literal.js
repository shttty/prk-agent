import { safeText } from "../../workbench/payloads/safe-text.js";
export async function copyLiteral(text) {
  const value = safeText(text);
  if (!value || typeof globalThis.navigator?.clipboard?.writeText !== "function") return false;
  try {
    await globalThis.navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
