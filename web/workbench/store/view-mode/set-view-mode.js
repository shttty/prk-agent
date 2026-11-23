import { patch } from "../updates/patch.js";
export function setViewMode(ctx, mode) {
    if (!["instances", "projects"].includes(mode)) return;
    try { globalThis.localStorage?.setItem("pi-session-view", mode); } catch { }
    patch(ctx, { viewMode: mode });
  }

