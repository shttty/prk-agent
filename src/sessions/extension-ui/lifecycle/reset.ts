import type { UiContext } from "../ui-types.ts";
import { publish } from "../publication/publish-revision.ts";
import { disposeComponent } from "../components/dispose-component.ts";
import { cancel } from "./cancel.ts";

export function reset(ctx: UiContext): void {
    cancel(ctx);
    for (const widget of ctx.state.widgets.values()) disposeComponent(ctx, widget.component);
    disposeComponent(ctx, ctx.state.header); disposeComponent(ctx, ctx.state.footer);
    for (const tool of ctx.tools.values()) { disposeComponent(ctx, tool.callComponent); disposeComponent(ctx, tool.resultComponent); }
    for (const client of ctx.clients.values()) for (const component of client.renderers.values()) disposeComponent(ctx, component);
    ctx.tools.clear(); ctx.executions.clear(); ctx.clients.clear();
    for (const controller of ctx.completions.values()) controller.abort();
    ctx.completions.clear(); ctx.autocompleteProvider = undefined;
    clearInterval(ctx.branchTimer); ctx.branchTimer = undefined; ctx.branchListeners.clear();
    ctx.state.status.clear(); ctx.state.notifications = []; ctx.state.working = { visible: true }; ctx.state.hiddenThinkingLabel = undefined; ctx.state.title = undefined; ctx.state.widgets.clear(); ctx.state.header = undefined; ctx.state.footer = undefined; ctx.autocompleteProviders.length = 0; ctx.state.editorText = ""; ctx.state.editorClientId = undefined; ctx.state.editorRevision += 1; ctx.state.toolsExpanded = false;
    publish(ctx);
  }
