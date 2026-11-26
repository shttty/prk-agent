import type { Payload } from "../payload/is-payload.ts";
import { isPayload } from "../payload/is-payload.ts";
import { asText } from "./as-text.ts";
import { FILE_TOOLS } from "./tool-text-constants.ts";
import { firstLine } from "./first-line.ts";
/** Header text after the tool name. bash keeps the command out of the header (the body shows it once); session_list has no input. */
export function toolHeadline(kind: string, args: Payload | null, code: string): string {
  if (kind === "bash" || kind === "session_list") return "";
  if (kind === "ask") return firstLine((Array.isArray(args?.questions) ? args.questions : []).map((question) => asText(isPayload(question) ? question.question : "")).filter(Boolean).join(" · "));
  if (FILE_TOOLS.has(kind)) {
    const offset = Number(args?.offset);
    return `${asText(args?.path)}${kind === "read" && Number.isFinite(offset) && offset > 1 ? `:${offset}` : ""}`;
  }
  if (kind === "generic" && args) return firstLine(JSON.stringify(args));
  return firstLine(code);
}
