import type { UnreadableSession } from "../../workbench/payloads/payload-types.ts";

/** What a session whose data cannot be read is called: its title when the Gateway still knows one, else its native id; "" when it has none (file-only diagnostic). */
export const unreadableIdentity = (issue: UnreadableSession): string => issue.label || issue.sessionId;
