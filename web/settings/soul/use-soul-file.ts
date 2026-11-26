import type { PageApi } from "../../shell/page/page-types.ts";
import { toFailure } from "../../shell/page/to-failure.ts";
import { useState } from "react";

type SoulView = { configured: boolean; content: string; revision: string; path: string; maxBytes: number };
import { useCallback } from "react";
import { useEffect } from "react";
import { isConnectionFailure } from "../../workbench/store/requests/is-connection-failure.js";
import { pageErrorMessage } from "../../workbench/store/requests/page-error-message.js";
import { useRelink } from "../list-page/use-relink.ts";

const PATH = "/settings/soul";

/**
 * The soul file through `/api/settings/soul`: `view` is the last read or saved file, `draft` the editor text.
 * A save carries the revision it edited; `conflict` is set when the file changed outside the page meanwhile.
 */
export function useSoulFile(api: PageApi) {
  const [view, setView] = useState<SoulView | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const adopt = useCallback((next: SoulView) => { setView(next); setDraft(next.content); setConflict(false); setError(""); setWaiting(false); }, []);
  const load = useCallback(() => {
    setBusy(true);
    return api.get<SoulView>(PATH).then(adopt).catch((cause: unknown) => { if (isConnectionFailure(cause)) setWaiting(true); else setError(toFailure(cause).message); }).finally(() => setBusy(false));
  }, [api, adopt]);
  useEffect(() => { void load(); }, [load]);
  useRelink(load, waiting);
  const save = async () => {
    setBusy(true); setError("");
    try { adopt(await api.post<SoulView>(PATH, { content: draft, revision: view?.revision })); }
    catch (cause) {
      if (toFailure(cause).code === "CONFLICT") setConflict(true);
      else setError(pageErrorMessage(cause));
    } finally { setBusy(false); }
  };
  const dirty = view !== null && draft !== view.content;
  return { view, waiting, draft, setDraft, dirty, busy, error, conflict, load, save, revert: () => setDraft(view?.content ?? "") };
}
