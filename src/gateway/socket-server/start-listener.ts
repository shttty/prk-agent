import { DEFAULT_GATEWAY_OPTIONS, type GatewayOptions } from "../../config/gateway/gateway-options.ts";
import { DEFAULT_LIMITS_OPTIONS, type LimitsOptions } from "../../config/limits/limits-options.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";
import { prepareSocket } from "../socket-endpoint/prepare-socket.ts";
import { assembleListener } from "./lifecycle/assemble-listener.ts";
import { openListener } from "./lifecycle/open-listener.ts";
import { closeListener } from "./lifecycle/close-listener.ts";

/**
 * Expose the Gateway-owned session collection on a local Unix socket. Every
 * session-scoped request names its routing identity; the Gateway remains the
 * only lifecycle authority. Clients observe, they never own.
 */
export async function startGateway(host: GatewaySessionHost, path: string, gateway: GatewayOptions = DEFAULT_GATEWAY_OPTIONS, limits: LimitsOptions = DEFAULT_LIMITS_OPTIONS) {
  await prepareSocket(path, limits);
  const ctx = assembleListener(host, path, gateway, limits);
  try {
    await openListener(ctx);
    ctx.server.on("error", () => { void closeListener(ctx).catch(() => { }); });
  } catch (error) {
    ctx.stopping = true;
    for (const peer of ctx.peers) peer.destroy();
    if (ctx.server.listening) await new Promise<void>((resolve) => ctx.server.close(() => resolve()));
    throw error;
  }
  return { close: () => closeListener(ctx), closed: ctx.done.promise };
}
