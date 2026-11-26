import type { UnreadableSession } from "./payload-types.ts";
import { isRecord } from "./is-record.ts";

const nonEmpty = (value: unknown): string => typeof value === "string" && value.trim() ? value : "";
const LOCATIONS = ["active", "archived", "unknown"] as const;

/**
 * `sessionId` is the native SDK id and is "" when the file's header identity is missing/empty/non-string: it is never replaced by
 * the file name. `key` is the UI-only row key (native id when there is one, else the session file); it is not an id for any route.
 * `location` is where the Gateway says the session lives; anything it does not state as active/archived (or an archived entry
 * without its archive group) is "unknown", never guessed. A missing `target` is a separate fact and does not change `location`.
 */
export function normalizeUnreadableSession(value: unknown): UnreadableSession | null {
  if (!isRecord(value) || typeof value.reason !== "string") return null;
  const sessionId = nonEmpty(value.sessionId);
  const sessionFile = nonEmpty(value.sessionFile);
  if (!sessionId && !sessionFile) return null;
  const claimed = LOCATIONS.find((location) => location === value.location) ?? "unknown";
  const group = isRecord(value.archived) ? nonEmpty(value.archived.group) : "";
  const archived = claimed === "archived" && isRecord(value.archived) && group
    ? { group, at: typeof value.archived.at === "string" ? value.archived.at : "", kernelOrphan: value.archived.kernelOrphan === true }
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
