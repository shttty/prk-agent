import { useState } from "react";
import { useCallback } from "react";
import { useEffect } from "react";

const PATH = "/settings/soul";

/**
 * The soul file through `/api/settings/soul`: `view` is the last read or saved file, `draft` the editor text.
 * A save carries the revision it edited; `conflict` is set when the file changed outside the page meanwhile.
 */
export function useSoulFile(api) {
  const [view, setView] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const adopt = useCallback((next) => { setView(next); setDraft(next.content); setConflict(false); setError(""); }, []);
  const load = useCallback(() => {
    setBusy(true);
    return api.get(PATH).then(adopt).catch((cause) => setError(cause.message)).finally(() => setBusy(false));
  }, [api, adopt]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    setBusy(true); setError("");
    try { adopt(await api.post(PATH, { content: draft, revision: view.revision })); }
    catch (cause) {
      if (cause.code === "CONFLICT") setConflict(true);
      else setError(cause.message);
    } finally { setBusy(false); }
  };
  const dirty = view !== null && draft !== view.content;
  return { view, draft, setDraft, dirty, busy, error, conflict, load, save, revert: () => setDraft(view.content) };
}
