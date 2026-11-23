import type { LinkWaiterContext } from "../channel-state.ts";
import { cleanup } from "./remove-link-waiter.ts";

export function reject(ctx: LinkWaiterContext, error: Error): void {
  cleanup(ctx); ctx.result.reject(error);
}
