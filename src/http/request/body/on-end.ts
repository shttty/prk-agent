import type { BodyContext } from "../request-state.ts";
import { finish } from "./finish.ts";
import { HttpError } from "../create-error.ts";

export const onEnd = (ctx: BodyContext): void => {
      if (ctx.declaredLength !== undefined && ctx.declaredLength !== ctx.size) {
        finish(ctx, () => ctx.reject(new HttpError(400, "Content-Length does not match the request body.")));
        return;
      }
      finish(ctx, () => ctx.resolve(Buffer.concat(ctx.chunks)));
    };
