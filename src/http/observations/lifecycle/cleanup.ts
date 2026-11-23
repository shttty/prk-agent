import type { StreamContext } from "../observation-state.ts";

export const cleanupStream = (ctx: StreamContext): void => {
      clearInterval(ctx.heartbeat);
      ctx.ended = true;
      ctx.unsubscribe?.();
      ctx.responses.delete(ctx.response);
    };
