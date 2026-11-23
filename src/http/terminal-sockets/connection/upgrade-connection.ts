import type { SocketContext } from "../socket-state.ts";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { serveTerminal } from "./serve-terminal.ts";

export function upgradeConnection(ctx: SocketContext, request: IncomingMessage, socket: Duplex, head: Buffer, sessionId: string, name: string, generation?: string): void {
      ctx.server.handleUpgrade(request, socket, head, (ws) => { void serveTerminal(ctx, ws, sessionId, name, generation); });
    }
