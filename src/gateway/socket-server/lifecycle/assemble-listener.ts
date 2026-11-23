import { createServer, type Socket } from "node:net";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { GatewayOptions } from "../../../config/gateway/gateway-options.ts";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { ListenerContext } from "../listener-state.ts";
import { acceptPeer } from "../connection/accept-peer.ts";

export function assembleListener(host: GatewaySessionHost, path: string, gateway: GatewayOptions, limits: LimitsOptions): ListenerContext {
  const peers = new Set<Socket>();
  const done = Promise.withResolvers<void>();
  // Consumers can await closed, but shutdown errors must not become unhandled.
 void done.promise.catch(() => { });
  const ctx: ListenerContext = {
    host, path, gateway, limits, peers, done,
    stopping: false,
    shutdownTask: undefined,
    server: createServer((socket) => acceptPeer(ctx, socket)),
  };
  return ctx;
}
