import type { BodyContext } from "../request-state.ts";
import { finish } from "./finish.ts";
import { HttpError } from "../create-error.ts";

export const onData = (ctx: BodyContext, chunk: Buffer | string): void => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      ctx.size += buffer.byteLength;
      if (ctx.size > ctx.http.bodyBytes) {
        ctx.request.resume();
        finish(ctx, () => ctx.reject(new HttpError(413, "Request body exceeds the byte limit.")));
        return;
      }
      ctx.chunks.push(buffer);
    };
