import type { LinkWaiterContext } from "../channel-state.ts";

export const cleanup = (ctx: LinkWaiterContext): void => {
  ctx.machine.waiters.delete(ctx.waiter);
  ctx.signal.removeEventListener("abort", ctx.abort);
};
