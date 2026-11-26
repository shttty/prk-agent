import type { ChatSessionRow } from "../thread/chat-state-types.ts";

/** The sessions with an ask waiting, in list order: `[{sessionId, label}]`. */
export const askingSessions = (sessions: Map<string, ChatSessionRow>) => [...sessions.values()].filter((sessionRow) => sessionRow.asking === true).map((sessionRow) => ({ sessionId: sessionRow.sessionId, label: String(sessionRow.label || "").trim() || sessionRow.sessionId }));
