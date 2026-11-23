export const snapshotOf = (sessionId, state) => ({ streamId: `mock-${sessionId}`, sessionId, sequence: 1, state, messages: [], queuedMessages: { steering: [], followUp: [] }, model: "clp/gpt-6", thinkingLevel: "medium", recentOperations: [], messageEntryIds: [] });

export const SESSIONS = [
  { label: "worker", sessionId: "w1", state: "idle", target: "alpha", cwd: "/data" },
  { label: "second", sessionId: "w2", state: "idle", target: "alpha", cwd: "/data" },
  { label: "daily", sessionId: "m1", state: "idle", target: "alpha", cwd: "/data" },
  { label: "closed", sessionId: "c1", state: "closed", target: "alpha", cwd: "/data" },
];
export const SNAPSHOTS = Object.fromEntries(SESSIONS.map((sessionRow) => [sessionRow.sessionId, snapshotOf(sessionRow.sessionId, sessionRow.state)]));

