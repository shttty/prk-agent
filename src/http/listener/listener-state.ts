import type { WebGatewayClient } from "../gateway-connection/client-types.ts";
import type { HttpOptions } from "../../config/http/http-options.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { ArtifactsOptions } from "../../config/artifacts/artifacts-options.ts";
import type { ServerResponse } from "node:http";
import { createServer } from "node:http";
import { createTerminalSockets } from "../terminal-sockets/assemble-terminal-sockets.ts";

export interface RequestContext {
  readonly gateway: WebGatewayClient;
  readonly http: HttpOptions;
  readonly limits: LimitsOptions;
  readonly artifacts: ArtifactsOptions;
  readonly gatewayRestart: { readonly unit: string; readonly timeoutMs: number };
  readonly home: string;
  readonly responses: Set<ServerResponse>;
}

export interface ListenerContext extends RequestContext {
  readonly server: ReturnType<typeof createServer>;
  readonly host: string;
  readonly port: number;
  readonly done: ReturnType<typeof Promise.withResolvers<void>>;
  origin: string;
  authority: string;
  stopping: boolean;
  closing: Promise<void> | undefined;
  terminalSockets: ReturnType<typeof createTerminalSockets> | undefined;
}
