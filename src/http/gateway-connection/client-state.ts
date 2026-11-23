import type { WebGatewayOptions } from "./client-types.ts";
import type { GatewayOptions } from "../../config/gateway/gateway-options.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { GatewayClient } from "../../gateway/socket-client/client-types.ts";

export interface ClientContext {
  readonly options: WebGatewayOptions;
  readonly gateway: GatewayOptions;
  readonly limits: LimitsOptions;
  readonly maxStreams: number;
  readonly streams: Set<GatewayClient>;
  pendingStreams: number;
  control: GatewayClient | undefined;
  connecting: Promise<GatewayClient> | undefined;
  reachable: boolean;
  closed: boolean;
}
