import { openWorkbenchEventSource } from "../workbench-snapshot/open-workbench-event-source.js";
import { loadModelCatalog } from "../workbench-snapshot/load-model-catalog.js";
import { loadUiConfig } from "../workbench-snapshot/load-ui-config.js";
import { patch } from "../updates/patch.js";
/** Open the collection subscription; its first snapshot is the workbench base and restores the selection. */
export function start(ctx) {
    if (ctx.disposed) return false;
    if (!ctx.locationListenerInstalled && typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("popstate", ctx.bound.handleLocationChange);
      globalThis.addEventListener("online", ctx.bound.handleConnectionResume);
      globalThis.document?.addEventListener("visibilitychange", ctx.bound.handleConnectionResume);
      globalThis.addEventListener("pagehide", ctx.bound.flushScroll);
      globalThis.document?.addEventListener("visibilitychange", ctx.bound.flushScroll);
      ctx.locationListenerInstalled = true;
    }
    if (ctx.workbenchSource) return true;
    patch(ctx, { service: "loading", session: { ...ctx.state.session, error: null } });
    void loadModelCatalog(ctx);
    if (!ctx.state.extensionUiRenderIntervalMs) void loadUiConfig(ctx);
    openWorkbenchEventSource(ctx);
    return true;
  }
