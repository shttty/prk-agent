import type { UiContext, ClientState, HostedNode } from "../ui-types.ts";
import type { Component } from "@earendil-works/pi-tui";
import { renderNode } from "./render-node.ts";

export function descriptor(ctx: UiContext, component: Component | undefined, client: ClientState, prefix: string): HostedNode | undefined { return component ? renderNode(ctx, component, client.width, client.nodes, prefix) : undefined; }
