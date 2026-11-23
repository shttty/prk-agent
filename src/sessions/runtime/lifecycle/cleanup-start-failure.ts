import type { RuntimeContext } from "../runtime-state.ts";

export async function cleanupStartFailure(ctx: RuntimeContext, error: unknown) : Promise<never> {
    ctx.disposeLibrary?.dispose();
    ctx.terminalEvents?.dispose();
    await ctx.python.close();
    await ctx.skillLease?.release();
    await ctx.fileLease?.release();
    await ctx.remoteLoad?.close();
    throw error;
  }
