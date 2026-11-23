import type { TerminalSessionContext } from "../terminal-session-state.ts";

export const pump = (ctx: TerminalSessionContext): void => {
      while (!ctx.released && ctx.inFlight < ctx.inFlightMax && ctx.queue.length > 0) {
        const next = ctx.queue.shift()!;
        ctx.inFlight++;
        const request = next.method === "terminalInput" ? { sessionId: ctx.sessionId, name: ctx.name, data: next.data } : { sessionId: ctx.sessionId, name: ctx.name, rows: next.rows, cols: next.cols };
        ctx.client.request(next.method, request).then(() => undefined, (error: unknown) => { if (!ctx.released) ctx.sink.failure(error); }).finally(() => { ctx.inFlight--; pump(ctx); });
      }
    };
