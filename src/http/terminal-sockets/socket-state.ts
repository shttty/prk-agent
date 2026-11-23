import type { WebGatewayClient } from "../gateway-connection/client-types.ts";
import type { HttpOptions } from "../../config/http/http-options.ts";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { WebTerminalSession } from "../gateway-connection/client-types.ts";

export interface SocketContext { readonly gateway: WebGatewayClient; readonly http: HttpOptions; readonly server: WebSocketServer; }
export interface SocketConnectionContext { readonly gateway: WebGatewayClient; readonly http: HttpOptions; readonly socket: WebSocket; readonly sessionId: string; readonly name: string; session: WebTerminalSession | undefined; ended: boolean; alive: boolean; beat: ReturnType<typeof setInterval> | undefined; }
