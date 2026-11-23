import type { ClientContext } from "../client-state.ts";

export const available = (ctx: ClientContext): boolean => ctx.reachable && !ctx.closed;
