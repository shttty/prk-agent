import type { WebGatewayClient } from "../gateway-connection/client-types.ts";
import type { HttpOptions } from "../../config/http/http-options.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import { WebSocketServer } from "ws";
import type { SocketContext } from "./socket-state.ts";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { upgradeConnection } from "./connection/upgrade-connection.ts";
import { closeSockets } from "./connection/close-sockets.ts";

export function createTerminalSockets(gateway: WebGatewayClient, http: HttpOptions, limits: LimitsOptions) {
  const server = new WebSocketServer({ noServer: true, maxPayload: limits.inputBytes });
  const ctx: SocketContext = { gateway, http, server };
  return {
    upgrade: (request: IncomingMessage, socket: Duplex, head: Buffer, sessionId: string, name: string, generation?: string): void => upgradeConnection(ctx, request, socket, head, sessionId, name, generation),
    close: (): void => closeSockets(ctx),
  };
}
