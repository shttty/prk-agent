import { trimDisplay } from "./trim-display.js";
/**
 * One SDK thinking block as a transcript part. A plugin `hiddenThinkingLabel` replaces every block with that label
 * (Pi's semantics); otherwise a block with readable text becomes a reasoning row and an empty, signature-only or
 * redacted block renders nothing.
 */
export function thinkingPart(text, label, redacted = false) {
  if (typeof label === "string" && label) return { type: "text", text: label };
  if (redacted || typeof text !== "string" || !text.trim()) return null;
  return { type: "reasoning", text: trimDisplay(text) };
}
