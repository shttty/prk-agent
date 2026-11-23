import { useCallback } from "react";
import { useState } from "react";

/** Ending a shell: `request(name)` opens the confirmation, `confirm` ends it on the server and then closes its tab (a failed
 * end keeps the tab and shows why, so no shell is left running unseen). Returns `{ ending, error, busy, request, cancel, confirm }`. */
export function useEndTerminal({ api, sessionId, engine }) {
  const [ending, setEnding] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useCallback((name) => { setError(""); setEnding(name); }, []);
  const cancel = useCallback(() => setEnding(null), []);
  const confirm = useCallback(async () => {
    setBusy(true);
    try {
      await api.post(`/sessions/${encodeURIComponent(sessionId)}/terminals/close`, { name: ending });
      engine?.closeTerminal(ending);
      setEnding(null);
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }, [api, sessionId, engine, ending]);
  return { ending, error, busy, request, cancel, confirm };
}
