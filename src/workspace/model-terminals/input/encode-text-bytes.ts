import { Buffer } from "node:buffer";
import { WireError } from "../../../gateway/wire/create-error.ts";

// Encode model terminal text input for PTY delivery without readline tab/newline loss.
export function textBytes(text: string, bracketedPasteMode: boolean, atPrompt: boolean): string {
  const normalized = text.replace(/\r\n/gu, "\n");
  if (/[\x00-\x08\x0b-\x1f\x7f]/u.test(normalized)) {
    throw new WireError("INVALID_REQUEST", "Control characters are not allowed in terminal_textsend; use terminal_keysend for control keys.");
  }
  if (bracketedPasteMode) return `\x1b[200~${normalized}\x1b[201~\r`;
  if (atPrompt && (normalized.includes("\n") || normalized.includes("\t"))) {
    return `eval "$(printf %s ${Buffer.from(normalized, "utf8").toString("base64")} | base64 -d)"\r`;
  }
  return `${normalized.replace(/\n/gu, "\r")}\r`;
}
