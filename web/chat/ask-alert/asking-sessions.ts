import type { SessionRow } from "../../workbench/store/store-types.ts";

/** The sessions with an ask waiting, in list order: `[{sessionId, label}]`. */
export const askingSessions = (sessions: Map<string, SessionRow>) => [...sessions.values()].filter((sessionRow) => sessionRow.asking === true).map((sessionRow) => ({ sessionId: sessionRow.sessionId, label: String(sessionRow.label || "").trim() || sessionRow.sessionId }));
