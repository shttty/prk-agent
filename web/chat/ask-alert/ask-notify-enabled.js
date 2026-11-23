import { NOTIFY_KEY } from "./ask-alert-constants.js";
import { notificationsAvailable } from "./notifications-available.js";
/** Switched on in settings and still permitted by the browser. */
export function askNotifyEnabled() {
  try { return notificationsAvailable() && window.localStorage.getItem(NOTIFY_KEY) === "1" && window.Notification.permission === "granted"; }
  catch { return false; }
}
