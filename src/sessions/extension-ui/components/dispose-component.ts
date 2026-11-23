import type { UiContext } from "../ui-types.ts";
import type { Component } from "@earendil-works/pi-tui";
import { containsComponent } from "./contains-component.ts";
import { renderError } from "../describe-render-error.ts";
import { notify } from "../notifications/notify.ts";

export function disposeComponent(ctx: UiContext, component: Component | undefined): void {
    if (!component || ctx.disposedComponents.has(component)) return;
    ctx.disposedComponents.add(component);
    for (const [settings, submenu] of [...ctx.settingsSubmenus]) if (containsComponent(component, settings)) submenu.close();
    for (const client of ctx.clients.values()) for (const [id, node] of client.nodes) if (containsComponent(component, node)) client.nodes.delete(id);
    if ("dispose" in component && typeof component.dispose === "function") {
      try { component.dispose(); } catch (error) { notify(ctx, `Extension component disposal failed: ${renderError(error)}`, "error"); }
    }
  }
