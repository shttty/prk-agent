import { foldKey } from "./fold-key.ts";

export function saveFoldPreference(sessionId: string, open: boolean) {
  try {
    if (open) localStorage.setItem(foldKey(sessionId), "1");
    else localStorage.removeItem(foldKey(sessionId));
  } catch { /* Storage can be disabled; keep the in-page choice. */ }
}
