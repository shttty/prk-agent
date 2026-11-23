import type { StreamContext } from "../observation-state.ts";

export const finishStream = (ctx: StreamContext): void => {
      if (ctx.ended) return;
      ctx.ended = true;
      ctx.unsubscribe?.();
      // Before the first snapshot there is no stream to end; the failed
      // subscription surfaces as an explicit HTTP error instead.
      if (ctx.response.headersSent && !ctx.response.destroyed) ctx.response.end();
    };
