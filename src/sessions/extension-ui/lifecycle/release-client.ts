import type { UiContext } from "../ui-types.ts";
import { disposeComponent } from "../components/dispose-component.ts";

export function releaseClient(ctx: UiContext, clientId: string): boolean {
    const client = ctx.clients.get(clientId);
    if (!client) return false;
    for (const component of client.renderers.values()) disposeComponent(ctx, component);
    ctx.clients.delete(clientId);
    for (const [key, tool] of ctx.tools) {
      if (!key.startsWith(`${clientId}:`)) continue;
      disposeComponent(ctx, tool.callComponent); disposeComponent(ctx, tool.resultComponent); ctx.tools.delete(key);
    }
    return true;
  }
