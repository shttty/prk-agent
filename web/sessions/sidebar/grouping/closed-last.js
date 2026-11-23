
export const CLOSED_STATES = new Set(["closed", "ended"]);

// Closed sessions stay in the same list, after the ones that can still run.
export const closedLast = (sessions) => [...sessions.filter((sessionRow) => !CLOSED_STATES.has(sessionRow.state)), ...sessions.filter((sessionRow) => CLOSED_STATES.has(sessionRow.state))];
