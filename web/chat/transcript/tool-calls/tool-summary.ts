import { safeText } from "../../../workbench/payloads/safe-text.js";
/** First meaningful line of the tool input, shown inline like `Ran <command>`. */
export function toolSummary(code: unknown): string {
  const line = safeText(code).split("\n").map((value) => value.trim()).find(Boolean) || "";
  return line.length > 160 ? `${line.slice(0, 160)}…` : line;
}
