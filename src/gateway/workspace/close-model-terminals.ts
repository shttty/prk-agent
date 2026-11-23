import type { HostContext } from "../host/host-state.ts";

export async function closeModelTerminals(ctx: HostContext, sessionId: string): Promise<void> {
    await ctx.workspace.modelTerminals.get(sessionId)?.closeAll();
    ctx.workspace.modelTerminals.delete(sessionId);
  }
