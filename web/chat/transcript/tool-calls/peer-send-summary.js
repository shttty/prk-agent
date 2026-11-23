import { safeText } from "../../../workbench/payloads/safe-text.js";
import { shortSessionId } from "./short-session-id.js";
import { toolSummary } from "./tool-summary.js";
/**
 * `→ <recipient label> · <first line>` for session_send (`to` is the recipient's native session id); null when the
 * arguments are not readable yet.
 */
export function peerSendSummary(toolName, code, sessions) {
  if (toolName !== "session_send") return null;
  try {
    const args = JSON.parse(code);
    const to = safeText(args?.to);
    if (!to) return null;
    const first = toolSummary(args.message);
    const recipient = sessions?.get?.(to);
    return `→ ${recipient?.label || shortSessionId(to)}${first ? ` · ${first}` : ""}`;
  } catch {
    return null;
  }
}
