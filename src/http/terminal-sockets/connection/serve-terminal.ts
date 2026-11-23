import type { SocketContext } from "../socket-state.ts";
import type { WebSocket } from "ws";
import type { SocketConnectionContext } from "../socket-state.ts";
import { parse } from "../protocol/parse-message.ts";
import { send } from "../protocol/send.ts";
import type { WebTerminalSink } from "../../gateway-connection/client-types.ts";
import { terminalSnapshot } from "../subscription/snapshot.ts";
import { terminalEvent } from "../subscription/event.ts";
import { terminalFailure } from "./failure.ts";
import { terminalEnd } from "./end.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { TERMINAL_SOCKET_FINAL } from "../protocol/terminal-protocol.ts";
import { setTimeout as sleep } from "node:timers/promises";

export async function serveTerminal(owner: SocketContext, socket: WebSocket, sessionId: string, name: string, generation?: string): Promise<void> {

    const ctx: SocketConnectionContext = { gateway: owner.gateway, http: owner.http, socket, sessionId, name, session: undefined, ended: false, alive: true, beat: undefined };
    ;
    // A browser that vanished without a close (phone asleep, network gone) is found by an unanswered ping.
    ctx.beat = setInterval(() => {
      if (!ctx.alive) { ctx.socket.terminate(); return; }
      ctx.alive = false;
      ctx.socket.ping();
    }, ctx.http.heartbeatMs);
    ctx.beat.unref();
    ctx.socket.on("pong", () => { ctx.alive = true; });
    ctx.socket.on("error", () => ctx.socket.terminate());
    ctx.socket.on("close", () => { ctx.ended = true; clearInterval(ctx.beat); ctx.session?.close(); });
    ctx.socket.on("message", (raw, binary) => {
      const message = parse(raw, binary);
      if (!message) { ctx.socket.close(1008, "Invalid terminal message."); return; }
      if (message.type === "ping") send(ctx, { type: "pong" });
      else if (!ctx.session) return;
      else if (message.type === "input") ctx.session.input(message.data);
      else ctx.session.resize(message.rows, message.cols);
    });

    const sink: WebTerminalSink = { snapshot: (value) => terminalSnapshot(ctx, value), event: (value) => terminalEvent(ctx, value), failure: (error) => terminalFailure(ctx, error), end: () => terminalEnd(ctx) };
    for (let attempt = 0; ; attempt++) {
      try {
        ctx.session = await ctx.gateway.terminalSession(ctx.sessionId, ctx.name, sink, generation);
        break;
      } catch (error: unknown) {
        if (ctx.ended) return;
        // Transient: a Gateway BUSY that ends by itself once the session settles (wake, kernel action). Everything else is final.
        const transient = error instanceof WireError && error.code === "BUSY" && error.details?.transient === true;
        if (!transient || attempt >= ctx.http.terminalBusyRetriesMax) {
          sink.failure(error);
          ctx.socket.close(TERMINAL_SOCKET_FINAL);
          return;
        }
        await sleep(Math.min(ctx.http.terminalBusyBackoffMaxMs, ctx.http.terminalBusyBackoffMs * 2 ** attempt));
        if (ctx.ended) return;
      }
    }
    if (ctx.ended) ctx.session!.close();
  
}
