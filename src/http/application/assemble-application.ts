import type { WebServer } from "../listener/listener-types.ts";
import type { WebGatewayConnection } from "../gateway-connection/client-types.ts";
import type { ApplicationContext } from "./application-state.ts";
import { closeApplication } from "./close-application.ts";

export function assembleApplication(server: WebServer, gateway: WebGatewayConnection) {
  const ctx: ApplicationContext = { server, gateway, closing: undefined };
  return { server, close: () => closeApplication(ctx), closed: server.closed };
}
