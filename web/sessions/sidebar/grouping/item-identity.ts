import type { Groupable } from "../sidebar-types.ts";

/** What names a row when it has no session id: an unreadable session's row key. */
export const itemIdentity = (item: Groupable): string => item.sessionId || item.key || "";
