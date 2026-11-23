import type { HostContext, Operation } from "../host-types.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";
import { finish } from "./finish-operation.ts";

export async function settle(ctx: HostContext, operation: Operation): Promise<void> {
  if (ctx.active !== operation || operation.pending) return;
  try {
    await operation.aborting;
    await ctx.session.waitForIdle();
  } catch (error) {
    operation.error = describeError(error, ctx.sessionOptions);
  }
  if (ctx.active === operation && !operation.pending) finish(ctx, operation);
}
