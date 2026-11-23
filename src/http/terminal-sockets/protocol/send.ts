import type { SocketConnectionContext } from "../socket-state.ts";

export const send = (ctx: SocketConnectionContext, frame: object): void => {
      if (ctx.socket.readyState !== ctx.socket.OPEN) return;
      if (ctx.socket.bufferedAmount > ctx.http.outputBytes) { ctx.socket.terminate(); return; }
      ctx.socket.send(JSON.stringify(frame));
    };
