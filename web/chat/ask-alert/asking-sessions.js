
/** The sessions with an ask waiting, in list order: `[{sessionId, label}]`. */
export const askingSessions = (sessions) => [...sessions.values()].filter((sessionRow) => sessionRow.asking === true).map((sessionRow) => ({ sessionId: sessionRow.sessionId, label: String(sessionRow.label || "").trim() || sessionRow.sessionId }));
