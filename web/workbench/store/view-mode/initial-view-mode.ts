import type { ViewMode } from "../store-types.ts";

export function initialViewMode(): ViewMode {
  try { return globalThis.localStorage?.getItem("pi-session-view") === "projects" ? "projects" : "instances"; }
  catch { return "instances"; }
}
