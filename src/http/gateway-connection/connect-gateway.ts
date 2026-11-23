import type { WebGatewayOptions } from "./client-types.ts";
import type { WebGatewayConnection } from "./client-types.ts";
import { DEFAULT_GATEWAY_OPTIONS } from "../../config/gateway/gateway-options.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../config/limits/limits-options.ts";
import { DEFAULT_HTTP_OPTIONS } from "../../config/http/http-options.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import type { ClientContext } from "./client-state.ts";
import type { GatewayClient } from "../../gateway/socket-client/client-types.ts";
import { openInitialControl } from "./control-connection/open-initial-control.ts";
import { assembleGatewayClient } from "./assemble-gateway-client.ts";

export async function connectWebGateway(options: WebGatewayOptions): Promise<WebGatewayConnection> {
  const gateway = options.gateway ?? DEFAULT_GATEWAY_OPTIONS;
  const limits = options.limits ?? DEFAULT_LIMITS_OPTIONS;
  const maxStreams = (options.http ?? DEFAULT_HTTP_OPTIONS).streamsMax;
  if (!Number.isSafeInteger(maxStreams) || maxStreams <= 0) {
    throw new WireError("CLIENT_ERROR", "Invalid maximum observation stream count.");
  }
  const ctx: ClientContext = { options, gateway, limits, maxStreams, streams: new Set<GatewayClient>(), pendingStreams: 0, control: undefined, connecting: undefined, reachable: true, closed: false };

  await openInitialControl(ctx);

  

  

  /** Open one dedicated Gateway connection for a long-lived observation; it counts toward the stream cap. */
  

  /**
   * One browser terminal = one dedicated Gateway connection: open + subscribe, then input/resize are pipelined on the
   * same ordered connection (the Gateway dispatches a connection's requests in arrival order and replies by id), so a
   * keystroke never waits for the previous one's reply. At most `pendingMax - 1` requests are in flight; anything
   * beyond that is queued in order and adjacent inputs are merged, so no byte is dropped or reordered.
   */
  

  

  return assembleGatewayClient(ctx);
}
