import type { InvocationContext } from "./invocation-types.ts";

export function cancel(ctx: InvocationContext): void {
  ctx.idle.abort(ctx.reason);
  for (const controller of ctx.active) controller.abort(ctx.reason);
  for (const controller of ctx.shutdownControllers) controller.abort(ctx.reason);
}
