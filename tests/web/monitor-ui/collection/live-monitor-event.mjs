export const live = (name, change) => ({ type: "session_monitor", sessionId: name, details: { monitor: change } });
