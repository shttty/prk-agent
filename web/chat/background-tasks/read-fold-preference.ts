import { foldKey } from "./fold-key.ts";

export function readFoldPreference(sessionId: string) {
  try { return localStorage.getItem(foldKey(sessionId)) === "1"; } catch { return false; }
}
