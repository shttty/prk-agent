import { asText } from "./as-text.js";
import { FILE_TOOLS } from "./tool-text-constants.js";
import { firstLine } from "./first-line.js";
/** Header text after the tool name. bash keeps the command out of the header (the body shows it once); session_list has no input. */
export function toolHeadline(kind, args, code) {
  if (kind === "bash" || kind === "session_list") return "";
  if (kind === "ask") return firstLine(args.questions.map((question) => asText(question?.question)).filter(Boolean).join(" · "));
  if (FILE_TOOLS.has(kind)) {
    const offset = Number(args.offset);
    return `${args.path}${kind === "read" && Number.isFinite(offset) && offset > 1 ? `:${offset}` : ""}`;
  }
  if (kind === "generic" && args) return firstLine(JSON.stringify(args));
  return firstLine(code);
}
