import type { SocketConnectionContext } from "../socket-state.ts";

export const terminalEnd = (ctx: SocketConnectionContext) => { if (!ctx.ended) ctx.socket.close(1012, "Terminal connection ended."); };
