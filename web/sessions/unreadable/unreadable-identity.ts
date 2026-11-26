import type { UnreadableIssue } from "../session-row-types.ts";

/** What a session whose data cannot be read is called: its title when the Gateway still knows one, else its native id; "" when it has none (file-only diagnostic). */
export const unreadableIdentity = (issue: UnreadableIssue): string => issue.label || issue.sessionId;
