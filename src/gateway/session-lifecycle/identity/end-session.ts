import type { HostContext } from "../../host/host-state.ts";
import { boundedError } from "../../../diagnostics/session-errors/truncate-error-detail.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";
import { WireError } from "../../wire/create-error.ts";
import { KERNEL_ORPHAN_MESSAGE } from "../kernel-constants.ts";

export async function endSession(ctx: HostContext, sessionId: string): Promise<void> {
  return ctx.methods.changeSessionRuntime(sessionId, async () => {
   const entry = ctx.methods.storedSession(sessionId);
   ctx.derivation.derivation.assertSettled(sessionId);
   let cleanup: unknown;
    await ctx.methods.closeModelTerminals(sessionId);
    await ctx.workspace.terminals.closeSession(sessionId);
    ctx.host.history.setSleeping(sessionId, false);
    const live = ctx.host.collection.snapshot().find((session) => session.sessionId === sessionId);
    if (live && live.state !== "closed") {
     try { await ctx.host.collection.closeSession(sessionId); }
     catch (error) { cleanup = error; ctx.methods.markKernelOrphan(sessionId); }
    } else if (entry.sleeping || ctx.lifecycle.recoveryStates.has(sessionId)) ctx.methods.publish("session_closed", ctx.methods.storedSession(sessionId));
    ctx.lifecycle.recoveryStates.delete(sessionId);
   ctx.methods.forgetHost(sessionId);
   if (cleanup === undefined) return;
   console.error(`[${new Date().toISOString()}] Session ${sessionId} ended; resource cleanup was not confirmed. ${boundedError(describeError(cleanup, ctx.host.config.session), ctx.host.config.session.errorDetailChars)}`);
   throw new WireError("UNAVAILABLE", `Session ended; cleanup was not confirmed. ${KERNEL_ORPHAN_MESSAGE}`, { closed: true });
  });
 }
