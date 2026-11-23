
/** System notifications need a secure context; the daily UI on plain http over the tailnet usually is not one. */
export const notificationsAvailable = () => typeof window !== "undefined" && window.isSecureContext === true && typeof window.Notification === "function";
