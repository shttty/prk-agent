import Anser from "anser";
import { safeText } from "../../workbench/payloads/safe-text.js";
import { ANSI_RE } from "./ansi-patterns.ts";
import { SGR_RE } from "./ansi-patterns.ts";
// Pass only SGR to anser: cursor movement, OSC links/titles and other terminal controls are not web content.
export function chunks(text: unknown) {
  const value = safeText(text).replace(ANSI_RE, (sequence) => SGR_RE.test(sequence) ? sequence.replace(/^\u009B/, "\u001B[") : "");
  return Anser.ansiToJson(value, { json: true, use_classes: true, remove_empty: true });
}
