import type { HostContext } from "../../host/host-state.ts";
import { WireError } from "../../wire/create-error.ts";

export async function runtimeChange<T>(ctx: HostContext, action: () => Promise<T>): Promise<T> {
    if (ctx.lifecycle.closing || ctx.lifecycle.mutationInProgress) throw new WireError("BUSY", "Gateway configuration is changing or shutting down.");
    ctx.lifecycle.runtimeChanges++;
    try { return await action(); }
    finally { ctx.lifecycle.runtimeChanges--; }
  }
