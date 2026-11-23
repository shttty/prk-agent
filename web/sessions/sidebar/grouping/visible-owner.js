import { text } from "../text.js";
/** Current manager of a derived session, when that manager is visible. */
export function visibleOwner(sessionRow, sessions) {
  const owner = text(sessionRow?.derivation?.owner).trim();
  return owner && owner !== sessionRow?.sessionId && sessions.has(owner) ? owner : "";
}
