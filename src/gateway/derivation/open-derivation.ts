import type { HostContext } from "../host/host-state.ts";
import { createSessionDerivation } from "../../sessions/derivation/assemble-derivation.ts";
import { boundedError } from "../../diagnostics/session-errors/truncate-error-detail.ts";
import { describeError } from "../../diagnostics/session-errors/describe-error.ts";
import { randomUUID } from "node:crypto";
import { finishTemporarySession } from "./finish-temporary-session.ts";
import { prepareResultPatch } from "./worktrees/prepare-result-patch.ts";
import { removeWorktree } from "./worktrees/remove-worktree.ts";

export function openDerivation(ctx: HostContext): void {
  ctx.derivation.derivation = createSessionDerivation({
    list: () => ctx.host.history.listAll(),
    get: ctx.methods.storedSession,
    spawn: ctx.methods.spawnDerived,
    prepareResult: (sessionId, state) => prepareResultPatch(ctx, sessionId, state),
    async destroy(names, group) {
      for (const sessionId of names) {
        const entry = ctx.methods.storedSession(sessionId);
        await ctx.lifecycle.transitions.get(sessionId)?.catch(() => undefined);
        const session = ctx.host.collection.snapshot().find((candidate) => candidate.sessionId === sessionId);
        let kernelOrphan = false;
        try {
          if (session && session.state !== "closed") await ctx.host.collection.closeSession(sessionId);
        } catch (error) {
          // Destruction must not depend on a reachable kernel; record the possible leftover instead.
          console.error(`[${new Date().toISOString()}] Session ${sessionId} did not shut down cleanly; a kernel may remain on its target. ${boundedError(describeError(error, ctx.host.config.session), ctx.host.config.session.errorDetailChars)}`);
          kernelOrphan = true;
          await ctx.host.collection.reset(sessionId).catch(() => undefined);
          ctx.methods.markKernelOrphan(sessionId);
        }
        await ctx.methods.closeModelTerminals(sessionId);
        await ctx.workspace.terminals.closeSession(sessionId);
        await removeWorktree(ctx, sessionId);
        ctx.host.history.setSleeping(sessionId, false);
        ctx.host.history.archive(sessionId, group, kernelOrphan);
        ctx.methods.forgetHost(sessionId);
        ctx.lifecycle.recoveryStates.delete(sessionId);
        console.error(`[${new Date().toISOString()}] Session ${sessionId} archived (group ${group}); history retained, project artifacts untouched.`);
        ctx.methods.publish("session_archived", entry, { group });
      }
    },
    async deliver(from, to, text) {
      if (ctx.lifecycle.closing) throw new Error("Gateway is shutting down; the message will not be replayed.");
      const sender = ctx.methods.storedSession(from);
      await ctx.methods.sessionHost(to).receivePeer({
        label: sender.label, sender: sender.sessionId,
        messageId: randomUUID(), replyTo: "", expectReply: false, body: text,
      }, "steer");
    },
    finishTemporarySession: (sessionId) => finishTemporarySession(ctx, sessionId),
    canControl: ctx.methods.canControlSession,
    setProject: ctx.methods.manageProject,
    setSupervisor: (actor, sessionId) => ctx.methods.setProjectSupervisor({ sessionId: sessionId }, actor),
  publish(sessionId) {
   // Ownership changes may alter either endpoint's eligibility between timer ticks.
   for (const binding of ctx.sessionHosts.hostBindings.values()) binding.idleSince = undefined;
   const entry = ctx.methods.storedSession(sessionId);
   ctx.methods.publish("session_derivation_changed", entry);
  },
    log(message, error) { console.error(`[${new Date().toISOString()}] ${message}${error === undefined ? "" : `\n${boundedError(describeError(error, ctx.host.config.session), ctx.host.config.session.errorDetailChars)}`}`); },
  }, ctx.derivation.derivationSchemas);
}
