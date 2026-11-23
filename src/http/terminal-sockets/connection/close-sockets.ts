import type { SocketContext } from "../socket-state.ts";

export function closeSockets(ctx: SocketContext): void {
      for (const client of ctx.server.clients) client.terminate();
      ctx.server.close();
    }
