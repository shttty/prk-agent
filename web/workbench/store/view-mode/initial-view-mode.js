
export function initialViewMode() {
  try { return globalThis.localStorage?.getItem("pi-session-view") === "projects" ? "projects" : "instances"; }
  catch { return "instances"; }
}

