import type { ObservationContext } from "./observation-state.ts";

export const releaseObservation = (ctx: ObservationContext, reason: string): void => {
      if (ctx.released) return;
      ctx.released = true;
      ctx.owner.streams.delete(ctx.client);
      ctx.client.disconnect();
      ctx.sink.end(reason);
    };
