import type { StoreContext } from "../store-context-types.ts";
import { openWorkbenchEventSource } from "../workbench-snapshot/open-workbench-event-source.ts";
import { loadModelCatalog } from "../workbench-snapshot/load-model-catalog.ts";
import { loadUiConfig } from "../workbench-snapshot/load-ui-config.ts";
import { patch } from "../updates/patch.ts";

/** Open the collection subscription; its first snapshot is the workbench base and restores the selection. */
export function start(ctx: StoreContext): boolean {
  if (ctx.disposed) return false;
  if (!ctx.locationListenerInstalled) {
    const { locationChange, connectionResume, flushScroll } = ctx.pageListeners;
    globalThis.addEventListener("popstate", locationChange);
    globalThis.addEventListener("online", connectionResume);
    globalThis.document?.addEventListener("visibilitychange", connectionResume);
    globalThis.addEventListener("pagehide", flushScroll);
    globalThis.document?.addEventListener("visibilitychange", flushScroll);
    ctx.locationListenerInstalled = true;
  }
  if (ctx.workbenchSource) return true;
  patch(ctx, { service: "loading", session: { ...ctx.state.session, error: null } });
  void loadModelCatalog(ctx);
  if (!ctx.state.extensionUiRenderIntervalMs) void loadUiConfig(ctx);
  openWorkbenchEventSource(ctx);
  return true;
}
