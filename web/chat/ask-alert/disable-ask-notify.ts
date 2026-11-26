import { NOTIFY_KEY } from "./ask-alert-constants.ts";
export function disableAskNotify() {
  try { window.localStorage.setItem(NOTIFY_KEY, "0"); } catch { /* private mode */ }
}
