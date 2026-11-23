import type { TerminalSessionContext } from "../terminal-session-state.ts";

export const releaseTerminal = (ctx: TerminalSessionContext, reason: string): void => {
      if (ctx.released) return;
      ctx.released = true;
      ctx.owner.streams.delete(ctx.client);
      ctx.client.disconnect();
      ctx.sink.end(reason);
    };
