import type { WebGatewayClient } from "../gateway-connection/client-types.ts";
import type { HttpOptions } from "../../config/http/http-options.ts";
import type { ServerResponse } from "node:http";

export interface StreamContext {
  readonly gateway: WebGatewayClient;
  readonly http: HttpOptions;
  readonly responses: Set<ServerResponse>;
  readonly sessionId: string | undefined;
  readonly response: ServerResponse;
  unsubscribe: (() => void) | undefined;
  ended: boolean;
  heartbeat: ReturnType<typeof setInterval> | undefined;
}
