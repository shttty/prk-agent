import type { StoreContext } from "../store-context-types.ts";
import type { ViewMode } from "../store-types.ts";
import { patch } from "../updates/patch.ts";

export function setViewMode(ctx: StoreContext, mode: ViewMode) {
  try { globalThis.localStorage?.setItem("pi-session-view", mode); } catch { /* the choice just does not survive a reload */ }
  patch(ctx, { viewMode: mode });
}
