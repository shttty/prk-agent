import type { BodyContext } from "../request-state.ts";

export const finish = (ctx: BodyContext, callback: () => void): void => {
      if (ctx.settled) return;
      ctx.settled = true;
      ctx.request.removeListener("data", ctx.onData);
      ctx.request.removeListener("end", ctx.onEnd);
      ctx.request.removeListener("aborted", ctx.onAborted);
      ctx.request.removeListener("error", ctx.onError);
      callback();
    };
