import { NOTIFY_KEY } from "./ask-alert-constants.js";
import { notificationsAvailable } from "./notifications-available.js";
/** Turn the setting on (asking the browser's permission if needed); resolves whether it is now on. */
export async function enableAskNotify() {
  if (!notificationsAvailable()) return false;
  const permission = window.Notification.permission === "granted" ? "granted" : await window.Notification.requestPermission();
  const granted = permission === "granted";
  try { window.localStorage.setItem(NOTIFY_KEY, granted ? "1" : "0"); } catch { /* private mode: the setting just does not persist */ }
  return granted;
}
