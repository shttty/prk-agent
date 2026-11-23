import type { ClientContext } from "../client-state.ts";

export const streamCount = (ctx: ClientContext): number => ctx.streams.size;
