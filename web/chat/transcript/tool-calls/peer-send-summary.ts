import { isPayload } from "../../payload/is-payload.ts";
import { safeText } from "../../../workbench/payloads/safe-text.js";
import { shortSessionId } from "./short-session-id.ts";
import { toolSummary } from "./tool-summary.ts";
/**
 * `→ <recipient label> · <first line>` for session_send (`to` is the recipient's native session id); null when the
 * arguments are not readable yet.
 */
export function peerSendSummary(toolName: string, code: string, sessions: Map<string, { label?: string }> | null | undefined): string | null {
  if (toolName !== "session_send") return null;
  try {
    const args: unknown = JSON.parse(code);
    if (!isPayload(args)) return null;
    const to = safeText(args.to);
    if (!to) return null;
    const first = toolSummary(args.message);
    const recipient = sessions?.get(to);
    return `→ ${recipient?.label || shortSessionId(to)}${first ? ` · ${first}` : ""}`;
  } catch {
    return null;
  }
}
