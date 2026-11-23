const foldKey = (sessionId) => `pi.background-tasks.open:${sessionId}`;

export function readFoldPreference(sessionId) {
  try { return localStorage.getItem(foldKey(sessionId)) === "1"; } catch { return false; }
}

export function saveFoldPreference(sessionId, open) {
  try {
    if (open) localStorage.setItem(foldKey(sessionId), "1");
    else localStorage.removeItem(foldKey(sessionId));
  } catch { /* Storage can be disabled; keep the in-page choice. */ }
}
