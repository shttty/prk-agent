import type { WebGatewayClient } from "../gateway-connection/client-types.ts";
import type { WebServerOptions } from "./listener-types.ts";
import type { ListenerContext } from "./listener-state.ts";
import { DEFAULT_HTTP_OPTIONS } from "../../config/http/http-options.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../config/limits/limits-options.ts";
import { DEFAULT_ARTIFACTS_OPTIONS } from "../../config/artifacts/artifacts-options.ts";
import { DEFAULT_GATEWAY_OPTIONS } from "../../config/gateway/gateway-options.ts";
import { resolvePrkHome } from "../../config/home/resolve-prk-home.ts";
import { validateWebAddress } from "../request/validate-web-address.ts";
import type { ServerResponse } from "node:http";
import { createServer } from "node:http";
import { acceptRequest } from "./requests/accept-request.ts";
import { createTerminalSockets } from "../terminal-sockets/assemble-terminal-sockets.ts";
import { handleUpgrade } from "../terminal-sockets/handle-upgrade.ts";

export function assembleListener(gateway: WebGatewayClient, options: WebServerOptions): ListenerContext {
  const http = options.http ?? DEFAULT_HTTP_OPTIONS;
  const limits = options.limits ?? DEFAULT_LIMITS_OPTIONS;
  const artifacts = options.artifacts ?? DEFAULT_ARTIFACTS_OPTIONS;
  const gatewayRestart = options.gatewayRestart ?? { unit: DEFAULT_GATEWAY_OPTIONS.systemdUnit, timeoutMs: DEFAULT_GATEWAY_OPTIONS.restartTimeoutMs };
  const home = resolvePrkHome(options.home);
  const host = options.host ?? http.host;
  const port = options.port ?? http.port;
  validateWebAddress(host, port);

  const responses = new Set<ServerResponse>();
  const server = createServer((request, response) => acceptRequest(ctx, request, response));
  server.requestTimeout = http.requestTimeoutMs;
  server.headersTimeout = http.headersTimeoutMs;

  const done = Promise.withResolvers<void>();
  const ctx: ListenerContext = { gateway, http, limits, artifacts, gatewayRestart, home, host, port, responses, server, done, origin: "", authority: "", stopping: false, closing: undefined, terminalSockets: undefined };
 void done.promise.catch(() => { });


  // Terminal I/O is a WebSocket, not HTTP: same Host/Origin checks as any mutation, because a socket can type into a shell.
  const terminalSockets = createTerminalSockets(gateway, http, limits);
  ctx.terminalSockets = terminalSockets;
  server.on("upgrade", (request, socket, head) => handleUpgrade(ctx, request, socket, head));


 return ctx;
}
