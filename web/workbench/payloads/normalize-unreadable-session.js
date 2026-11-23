import { isRecord } from "./is-record.js";
const nonEmpty = (value) => typeof value === "string" && value.trim() ? value : "";
const LOCATIONS = new Set(["active", "archived", "unknown"]);
/**
 * One entry of the workbench `unreadableSessions`: a session whose stored data cannot be read (diagnostics only, never a sessionRow).
 * `sessionId` is the native SDK id and is "" when the file's header identity is missing/empty/non-string: it is never replaced by
 * the file name. `key` is the UI-only row key (native id when there is one, else the session file); it is not an id for any route.
 * `location` is where the Gateway says the session lives; anything it does not state as active/archived (or an archived entry
 * without its archive group) is "unknown", never guessed. A missing `target` is a separate fact and does not change `location`.
 */
export function normalizeUnreadableSession(value) {
  if (!isRecord(value) || typeof value.reason !== "string") return null;
  const sessionId = nonEmpty(value.sessionId);
  const sessionFile = nonEmpty(value.sessionFile);
  if (!sessionId && !sessionFile) return null;
  const claimed = LOCATIONS.has(value.location) ? value.location : "unknown";
  const archived = claimed === "archived" && isRecord(value.archived) && nonEmpty(value.archived.group)
    ? { group: value.archived.group, at: typeof value.archived.at === "string" ? value.archived.at : "", kernelOrphan: value.archived.kernelOrphan === true }
    : null;
  return {
    key: sessionId ? `id:${sessionId}` : `file:${sessionFile}`,
    location: claimed === "archived" && !archived ? "unknown" : claimed,
    sessionId,
    sessionFile,
    reason: value.reason,
    label: nonEmpty(value.label),
    target: nonEmpty(value.target),
    archived,
  };
}
