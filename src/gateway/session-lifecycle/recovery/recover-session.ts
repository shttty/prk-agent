import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import type { CreatedSession } from "../../session-views/session-view-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { validSessionCwd } from "../../instances/validate-session-cwd.ts";
import { isAbsoluteCwd } from "../../../config/execution-target/is-absolute-cwd.ts";
import { ABSOLUTE_CWD_MESSAGE } from "../../instances/cwd-constants.ts";
import { describeError } from "../../../diagnostics/session-errors/describe-error.ts";
import { configurationIssue } from "../../../config/execution-target/configuration-issue.ts";
import { boundedError } from "../../../diagnostics/session-errors/truncate-error-detail.ts";

export async function recoverSession(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["recoverSession"]>[0], request: Parameters<GatewaySessionHost["recoverSession"]>[1]): Promise<CreatedSession> {
   if (request.mode !== "auto" && request.mode !== "new") throw new WireError("INVALID_REQUEST", "Recovery mode must be auto or new.");
   if (request.mode === "auto" && (request.target !== undefined || request.cwd !== undefined)) {
     throw new WireError("INVALID_REQUEST", "Only mode new can change target or cwd.");
   }
   if (request.mode === "new" && !request.target) throw new WireError("INVALID_REQUEST", "Mode new requires a target.");
   return ctx.methods.changeSessionRuntime(sessionId, async () => {
        const session = ctx.methods.storedSession(sessionId);
        let entry = session;
        const live = ctx.host.collection.snapshot().find((session) => session.sessionId === sessionId);
        const runtime = ctx.host.collection.get(sessionId);
        // A live session whose kernel can no longer execute gets a new kernel like a closed one (same history).
        const rebuilding = live?.state === "idle" && runtime !== undefined && ctx.methods.kernelUnusable(runtime);
        if (live && live.state !== "closed" && !rebuilding) {
          throw new WireError("BUSY", "Only a closed session, or an idle session whose kernel can no longer execute, can be recovered.");
        }
        if (rebuilding && ctx.methods.unsettled(runtime)) throw new WireError("BUSY", "Session runtime must settle before recovery.");
        const retargeting = request.mode === "new";
        const target = ctx.instances.targets.find((candidate) => candidate.id === (retargeting ? request.target : entry.target));
        if (!target) {
          if (retargeting) throw new WireError("NOT_FOUND", "The selected execution target is not configured.");
          return ctx.methods.historicalResult(entry, ctx.methods.markUnavailable(sessionId, "The saved session target is no longer configured; choose a new target explicitly."));
        }
        const previous = { target: entry.target, cwd: entry.cwd };
        const nextCwd = retargeting ? request.cwd ?? target.kernel.cwd : entry.cwd;
        if (retargeting && (!validSessionCwd(nextCwd, ctx.host.config.limits) || !isAbsoluteCwd(nextCwd))) throw new WireError("INVALID_REQUEST", ABSOLUTE_CWD_MESSAGE);
        if (retargeting) {
          await ctx.methods.closeModelTerminals(sessionId);
          if (rebuilding) {
            await ctx.workspace.terminals.closeSession(sessionId);
            await ctx.host.collection.reset(sessionId);
          }
          // Release the old runtime before durably changing its execution target.
          ctx.host.collection.forget(sessionId);
          ctx.host.history.retarget(sessionId, { target: target.id, cwd: nextCwd });
          entry = ctx.methods.stored(sessionId);
        }
        const issue = configurationIssue(target);
        if (issue) {
          ctx.host.history.setSleeping(sessionId, true);
          const pending = ctx.methods.stored(sessionId);
          ctx.methods.publish("session_recovered", pending);
          return ctx.methods.historicalResult(pending, { status: "unavailable", message: issue.message });
        }
        const recoveryMessage = retargeting
          ? `The user moved this session to a new execution environment: target ${previous.target} -> ${target.id}, working directory ${previous.cwd} -> ${nextCwd}. `
            + "Files from the previous working directory are not available unless they also exist at the new location; previous Python variables are absent."
          : "";
        try {
          if (rebuilding && !retargeting) {
            await ctx.methods.closeModelTerminals(sessionId);
            await ctx.workspace.terminals.closeSession(sessionId);
          }
          const runtime = await ctx.host.collection.create(
            target.id,
            entry.manager,
            { mode: "new", cwd: entry.cwd }
          );
     ctx.host.history.setSleeping(sessionId, false);
          const current = ctx.methods.stored(sessionId);
          if (retargeting) {
            // Into the live context (like the wake notice), so the model stops trusting paths from the old environment.
            await runtime.session.sendCustomMessage({
              customType: "gateway-session-recovery", content: recoveryMessage, display: true,
              details: { version: 1, sessionId: sessionId, mode: "new", retargeted: true },
            }, { triggerTurn: false });
          }
          const recovery = { status: "new", message: recoveryMessage } as const;
          ctx.lifecycle.recoveryStates.set(sessionId, recovery);
          ctx.methods.publish("session_recovered", current);
          const recoveredSession = ctx.methods.managedSessionSnapshot(current, recovery);
          return { session: recoveredSession, snapshot: ctx.methods.sessionHost(sessionId).getSnapshot() };
        } catch (error) {
          const detail = describeError(error, ctx.host.config.session);
          console.error(`[${new Date().toISOString()}] Gateway session recovery failed for ${sessionId} (${request.mode}); target=${target.id}.\n${boundedError(detail, ctx.host.config.session.errorDetailChars)}`);
          let cleanupFailure: unknown;
          try { await ctx.host.collection.reset(sessionId); }
          catch (cleanupError) { cleanupFailure = cleanupError; }
          const failureMessage = "A new Python kernel could not be created; check the target.";
          if (retargeting) {
            try { ctx.host.collection.forget(sessionId); ctx.host.history.retarget(sessionId, previous); }
            catch (revertError) { console.error(`[${new Date().toISOString()}] Session ${sessionId} could not restore its previous execution environment. ${boundedError(describeError(revertError, ctx.host.config.session), ctx.host.config.session.errorDetailChars)}`); }
          }
          const failureDetail = boundedError(error instanceof Error ? error.message : String(error), ctx.host.config.session.errorDetailChars);
          if (cleanupFailure) console.error(`[${new Date().toISOString()}] Session recovery cleanup was not confirmed for ${sessionId}.\n${boundedError(describeError(cleanupFailure, ctx.host.config.session), ctx.host.config.session.errorDetailChars)}`);
          return ctx.methods.historicalResult(ctx.methods.stored(sessionId), ctx.methods.markUnavailable(sessionId, `${failureMessage} ${failureDetail}`, error));
        }
      });
    }
