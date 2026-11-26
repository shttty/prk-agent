import type { Payload } from "../payload/is-payload.ts";
import { isPayload } from "../payload/is-payload.ts";
import { asText } from "./as-text.ts";
import { FILE_TOOLS } from "./tool-text-constants.ts";
/**
 * Which structured body a built-in tool gets. Unreadable arguments (still streaming, not JSON) and every other tool
 * fall to "generic"; `args` is null in that case.
 */
export function toolKind(toolName: string, args: Payload | null, code: string): string {
  if (toolName === "kernel_code") return code ? "kernel_code" : "generic";
  if (!args) return "generic";
  if (toolName === "bash") return asText(args.command) ? "bash" : "generic";
  if (toolName === "ask") return Array.isArray(args.questions) && args.questions.some(isPayload) ? "ask" : "generic";
  if (FILE_TOOLS.has(toolName) && asText(args.path)) return toolName === "write" && typeof args.content !== "string" ? "generic" : toolName;
  if (toolName === "session_list") return "session_list";
  return "generic";
}
