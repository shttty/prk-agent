import type { UiContext, ClientState, HostedNode } from "../ui-types.ts";
import type { Component } from "@earendil-works/pi-tui";
import { renderError } from "../describe-render-error.ts";
import { disposeComponent } from "../components/dispose-component.ts";

export function readonlyRenderer(ctx: UiContext, client: ClientState, rendererErrors: Array<{ id: string; message: string }>, id: string, factory: () => Component | undefined): HostedNode | undefined {
      let component: Component | undefined;
      try {
        component = factory();
        if (!component) return undefined;
        const lines = component.render(client.width);
        client.renderers.set(id, component);
        return { id, kind: "text", lines };
      } catch (error) {
        rendererErrors.push({ id, message: renderError(error) });
        disposeComponent(ctx, component);
        return undefined;
      }
    }
