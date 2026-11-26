import { NOTIFY_KEY } from "./ask-alert-constants.ts";
import { notificationsAvailable } from "./notifications-available.ts";
/** Switched on in settings and still permitted by the browser. */
export function askNotifyEnabled() {
  try { return notificationsAvailable() && window.localStorage.getItem(NOTIFY_KEY) === "1" && window.Notification.permission === "granted"; }
  catch { return false; }
}
