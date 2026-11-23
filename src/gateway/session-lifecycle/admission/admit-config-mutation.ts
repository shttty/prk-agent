import type { HostContext } from "../../host/host-state.ts";
import { WireError } from "../../wire/create-error.ts";

export async function exclusive<T>(ctx: HostContext, action: () => Promise<T>): Promise<T> {
    if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; target state was not changed.");
    if (ctx.lifecycle.mutationInProgress || ctx.lifecycle.runtimeChanges) throw new WireError("BUSY", "Another target or session mutation is already in progress.");
    ctx.lifecycle.mutationInProgress = true;
    try { return await action(); }
    finally { ctx.lifecycle.mutationInProgress = false; }
  }
