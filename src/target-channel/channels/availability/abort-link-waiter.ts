import { errorOf } from "../../connection-error/normalize-error.ts";
import type { LinkWaiterContext } from "../channel-state.ts";

export const abort = (ctx: LinkWaiterContext): void => ctx.waiter.reject(errorOf(ctx.signal.reason));
