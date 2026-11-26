import type { HostContext } from "../../host/host-state.ts";
import { boundedError } from "../../../diagnostics/session-errors/truncate-error-detail.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";
import { WireError } from "../../wire/create-error.ts";

export async function wake(ctx: HostContext, sessionId: string): Promise<void> {
  while (ctx.lifecycle.transitions.has(sessionId)) await ctx.lifecycle.transitions.get(sessionId);
  const entry = ctx.methods.storedSession(sessionId);
  if (!entry.sleeping) return;
  const task = (async () => {
   console.error(`[${new Date().toISOString()}] Session ${sessionId} waking from idle sleep.`);
   try {
     const target = ctx.instances.targets.find((candidate) => candidate.id === entry.target);
     if (!target) throw new Error("Saved execution target is no longer configured.");
     const runtime = await ctx.host.collection.create(target.id, entry.manager, { mode: "wake", cwd: entry.cwd });
     if (!runtime.session.isIdle || runtime.session.isCompacting || runtime.session.pendingMessageCount > 0) throw new Error("Resumed SDK session is not ready for new input.");
     await runtime.session.sendCustomMessage({
      customType: "gateway-internal-notification", display: false,
      content: "This session resumed after intentional idle sleep. Its new Python kernel has initialized successfully; previous in-memory Python variables were not retained. Conversation history and project files are unchanged.",
     }, { triggerTurn: false });
    ctx.host.history.setSleeping(sessionId, false);
    ctx.lifecycle.recoveryStates.delete(sessionId);
    ctx.methods.sessionHost(sessionId);
    ctx.methods.publish("session_awake", ctx.methods.storedSession(sessionId));
    console.error(`[${new Date().toISOString()}] Session ${sessionId} awake; no previous input was replayed.`);
   } catch (error) {
    ctx.host.history.setSleeping(sessionId, true);
    ctx.sessionHosts.hostBindings.get(sessionId)?.refresh();
    try {
     if (ctx.host.collection.snapshot().some((session) => session.sessionId === sessionId)) await ctx.host.collection.reset(sessionId);
    } catch (cleanupError) {
     console.error(`[${new Date().toISOString()}] Session ${sessionId} wake cleanup failed. ${boundedError(describeError(cleanupError, ctx.host.config.session), ctx.host.config.session.errorDetailChars)}`);
    }
    console.error(`[${new Date().toISOString()}] Session ${sessionId} wake failed; sleeping identity retained. ${boundedError(describeError(error, ctx.host.config.session), ctx.host.config.session.errorDetailChars)}`);
    // A failed environment deployment is reported by its own code and one-line reason; the log above keeps the stack.
    const deployment = error instanceof WireError && error.code === "DEPLOYMENT_FAILED";
    const reason = deployment ? error.message : describeError(error, ctx.host.config.session);
    throw new WireError(deployment ? "DEPLOYMENT_FAILED" : "UNAVAILABLE", `Session could not wake; this input was not submitted. ${reason}`, { submitted: false, stage: "wake", reason });
   }
  })();
  ctx.lifecycle.transitions.set(sessionId, task);
  try { await task; } finally { ctx.lifecycle.transitions.delete(sessionId); }
 }
