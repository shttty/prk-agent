import type { RequestContext } from "../generation-types.ts";
import { errorOf } from "../connection/normalize-error.ts";
import { abortRequest } from "./abort-request.ts";

export function handleRequestAbort(ctx: RequestContext): void {
  abortRequest(ctx, errorOf(ctx.hooks.signal?.reason ?? new Error("Remote extension callback aborted.")));
}
