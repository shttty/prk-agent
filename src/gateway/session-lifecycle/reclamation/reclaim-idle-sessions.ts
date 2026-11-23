import type { HostContext } from "../../host/host-state.ts";
import { readDerivedSession } from "../../../sessions/derivation/read-derived-session.ts";
import { boundedError } from "../../../diagnostics/session-errors/truncate-error-detail.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";
import { appendNativeSessionState } from "../../../sessions/history/append-native-session-state.ts";

export async function reclaimIdle(ctx: HostContext): Promise<void> {
  if (ctx.lifecycle.closing || ctx.lifecycle.mutationInProgress || ctx.lifecycle.runtimeChanges) return;
  for (const entry of ctx.host.history.listAll()) {
   if (entry.sleeping) continue;
   const runtime = ctx.host.collection.get(entry.sessionId);
   const binding = ctx.sessionHosts.hostBindings.get(entry.sessionId);
   if (!runtime || !binding) continue;
   const canReclaim = () => {
    const derived = readDerivedSession(entry.manager, ctx.derivation.derivationSchemas);
    // Submitted persistent/user children may sleep; delivery is recorded in native history.
    let settled = !derived || derived.phase === "delivered" || derived.phase === "submitted";
    try { ctx.derivation.derivation.assertSettled(entry.sessionId); } catch { settled = false; }
    return settled && !ctx.derivation.derivation.isChanging(entry.sessionId) && runtime.host.isIdle === true
     && !ctx.methods.unsettled(runtime) && !runtime.terminalActive;
   };
   if (!canReclaim()) {
    binding.idleSince = undefined;
    continue;
   }
   binding.idleSince ??= Date.now();
   if (Date.now() - binding.idleSince < ctx.lifecycle.sessionIdleTimeoutMs) continue;
   const task = ctx.methods.runtimeChange(async () => {
    if (entry.sleeping || ctx.host.collection.get(entry.sessionId) !== runtime
     || ctx.sessionHosts.hostBindings.get(entry.sessionId) !== binding || !canReclaim()) {
     binding.idleSince = undefined;
     return;
    }
    appendNativeSessionState({ manager: runtime.session.sessionManager }, runtime.session);
    ctx.host.history.setSleeping(entry.sessionId, true);
    binding.refresh();
    console.error(`[${new Date().toISOString()}] Session ${entry.sessionId} entering idle sleep.`);
    try {
     await ctx.host.collection.reset(entry.sessionId);
     ctx.lifecycle.recoveryStates.delete(entry.sessionId);
     ctx.methods.publish("session_sleeping", ctx.methods.storedSession(entry.sessionId));
     console.error(`[${new Date().toISOString()}] Session ${entry.sessionId} sleeping; Gateway remains running.`);
    } catch (error) {
     // The runtime record is already closed; an unreachable kernel must not block sleep.
     console.error(`[${new Date().toISOString()}] Session ${entry.sessionId} kernel shutdown failed during idle sleep; a kernel may remain on the target. ${boundedError(describeError(error, ctx.host.config.session), ctx.host.config.session.errorDetailChars)}`);
     ctx.methods.markKernelOrphan(entry.sessionId);
     ctx.lifecycle.recoveryStates.delete(entry.sessionId);
     ctx.methods.publish("session_sleeping", ctx.methods.storedSession(entry.sessionId));
    }
   });
   ctx.lifecycle.transitions.set(entry.sessionId, task);
   try { await task; } finally { ctx.lifecycle.transitions.delete(entry.sessionId); }
   if (ctx.lifecycle.closing || ctx.lifecycle.runtimeChanges) return;
  }
 }
