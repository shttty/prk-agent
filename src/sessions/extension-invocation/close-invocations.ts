import type { InvocationContext } from "./invocation-types.ts";
import { cancel } from "./cancel-invocations.ts";

export function close(ctx: InvocationContext): void {
  ctx.lifetime.abort(ctx.reason);
  cancel(ctx);
}
