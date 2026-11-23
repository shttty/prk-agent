import type { UiContext } from "../ui-types.ts";
import { disposeComponent } from "../components/dispose-component.ts";
import { cancel } from "./cancel.ts";

export function dispose(ctx: UiContext): void {
    if (ctx.disposed) return;
    ctx.disposed = true;
    ctx.unsubscribe!();
    cancel(ctx);
    for (const widget of ctx.state.widgets.values()) disposeComponent(ctx, widget.component);
    disposeComponent(ctx, ctx.state.header); disposeComponent(ctx, ctx.state.footer);
    for (const tool of ctx.tools.values()) { disposeComponent(ctx, tool.callComponent); disposeComponent(ctx, tool.resultComponent); }
    for (const client of ctx.clients.values()) for (const component of client.renderers.values()) disposeComponent(ctx, component);
    for (const controller of ctx.completions.values()) controller.abort();
    clearInterval(ctx.branchTimer); ctx.branchListeners.clear(); ctx.completions.clear(); ctx.autocompleteProvider = undefined;
    ctx.listeners.clear(); ctx.clients.clear(); ctx.tools.clear(); ctx.executions.clear(); ctx.autocompleteProviders.length = 0; ctx.terminalInputHandlers.clear();
  }
