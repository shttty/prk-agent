import type { ApplicationContext } from "./application-state.ts";

export const closeApplication = (ctx: ApplicationContext): Promise<void> => ctx.closing ??= (async () => {
    const errors: unknown[] = [];
    try { await ctx.server.close(); } catch (error: unknown) { errors.push(error); }
    try { await ctx.gateway.close(); } catch (error: unknown) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, "Web client shutdown failed; Gateway-owned sessions were not affected.");
  })();
