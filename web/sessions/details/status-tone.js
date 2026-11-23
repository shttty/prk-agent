
export const statusTone = (value) => value === "unavailable" ? "error" : value === "sleeping" ? "sleep" : ["running", "starting", "cancel_requested", "closing"].includes(value) ? "run" : value === "idle" ? "ok" : "idle";

