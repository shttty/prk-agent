import type { WebGatewayClient } from "../gateway-connection/client-types.ts";
import type { WebServerOptions } from "./listener-types.ts";
import type { WebServer } from "./listener-types.ts";
import { assembleListener } from "./assemble-listener.ts";
import { openListener } from "./lifecycle/open-listener.ts";
import { closeListener } from "./lifecycle/close-listener.ts";

export async function startWebServer(gateway: WebGatewayClient, options: WebServerOptions = {}): Promise<WebServer> {
  const ctx = assembleListener(gateway, options);
  await openListener(ctx);
  return { url: ctx.origin, close: () => closeListener(ctx), closed: ctx.done.promise };
}
