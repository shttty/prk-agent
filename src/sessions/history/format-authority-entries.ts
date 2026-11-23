import type { SessionManager, SessionEntry } from "@earendil-works/pi-coding-agent";
import { type LimitsOptions, DEFAULT_LIMITS_OPTIONS } from "../../config/limits/limits-options.ts";
import { validateMetadataSessionId } from "./identity/validate-metadata-session-id.ts";
import { BINDING_TYPE } from "./history-protocol.ts";
import { isRecord } from "./metadata/is-history-metadata-record.ts";
import { scopedAuthorityEntry } from "./metadata/scoped-authority-entry.ts";
import { invalid } from "./reject-invalid-history.ts";

/** Project only Gateway authority; native settings, projects, and SDK history stay raw. */
export function projectAuthorityEntries(manager: SessionManager, limits: LimitsOptions = DEFAULT_LIMITS_OPTIONS): readonly SessionEntry[] {
  const sessionId = manager.getSessionId();
  validateMetadataSessionId(sessionId, "session identity", limits);
  const entries = manager.getEntries();
  const forked = manager.getHeader()?.parentSession !== undefined;
  const scoped = entries.some((entry) => entry.type === "custom" && entry.customType === BINDING_TYPE
    && isRecord(entry.data) && entry.data.sessionId === sessionId);
  if (!forked && !scoped && entries.some((entry) => entry.type === "custom" && entry.customType === BINDING_TYPE)) {
    invalid("binding session identity at /sessionId");
  }
  if (forked && !scoped) return Object.freeze([]);
  return Object.freeze(entries.filter((entry) => {
    if (!scopedAuthorityEntry(entry)) return true;
    return scoped && isRecord(entry.data) && entry.data.sessionId === sessionId;
  }));
}
