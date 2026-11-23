import type { RuntimeContext } from "../runtime-state.ts";

export function close(ctx: RuntimeContext): Promise<void> {
      return ctx.closePromise ??= (async () => {
        const failures: unknown[] = [];
        try { await ctx.active.host.close(); } catch (error) { failures.push(error); }
        try { await ctx.python.close(); } catch (error) { failures.push(error); }
        try { await ctx.skillLease?.release(); } catch (error) { failures.push(error); }
        try { await ctx.fileLease?.release(); } catch (error) { failures.push(error); }
        try { await ctx.remoteLoad?.close(); } catch (error) { failures.push(error); }
        if (failures.length) throw new AggregateError(failures, "Session runtime shutdown failed.");
      })();
    }
