import type { GatewayClient } from "../socket-client/client-types.ts";
import type { loadPrkConfig } from "../../config/document/load-prk-config.ts";
import type { startGateway } from "../socket-server/start-listener.ts";
import type { startWebApplication } from "../../http/application/start-application.ts";

export interface GatewayCommandContext {
  endpoint: Awaited<ReturnType<typeof startGateway>> | undefined;
}

export interface WebCommandContext {
  readonly application: Awaited<ReturnType<typeof startWebApplication>>;
}

export interface AttachCommandContext {
  readonly client: GatewayClient;
  readonly config: Awaited<ReturnType<typeof loadPrkConfig>>;
}
