import type { Server, Socket } from "node:net";
import type { GatewayOptions } from "../../config/gateway/gateway-options.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export interface ListenerContext {
  readonly host: GatewaySessionHost;
  readonly path: string;
  readonly gateway: GatewayOptions;
  readonly limits: LimitsOptions;
  readonly peers: Set<Socket>;
  readonly done: ReturnType<typeof Promise.withResolvers<void>>;
  readonly server: Server;
  stopping: boolean;
  shutdownTask: Promise<void> | undefined;
}
