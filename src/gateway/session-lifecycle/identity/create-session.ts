import type { HostContext } from "../../host/host-state.ts";
import type { SessionManager } from "@earendil-works/pi-coding-agent";
import type { StoredSession } from "../../../sessions/history/history-types.ts";
import type { CreatedSession } from "../../session-views/session-view-types.ts";
import { WireError } from "../../wire/create-error.ts";
import { validSessionCwd } from "../../instances/validate-session-cwd.ts";
import { isAbsoluteCwd } from "../../../config/execution-target/is-absolute-cwd.ts";
import { ABSOLUTE_CWD_MESSAGE } from "../../instances/cwd-constants.ts";
import { configurationIssue } from "../../../config/execution-target/configuration-issue.ts";
import type { ProjectSelection } from "../../projects/project-types.ts";
import { resolveProject } from "../../projects/resolve-project.ts";
import { rememberProject } from "../../projects/remember-project.ts";

export async function createManagedSession(ctx: HostContext, request: { target: string; label?: string; cwd?: string; project?: ProjectSelection }, prepare?: (manager: SessionManager) => void | string | Promise<void | string>, cloneSource?: StoredSession, cloneEntryId?: string): Promise<CreatedSession> {
    const project = request.project === undefined ? undefined : resolveProject(ctx, request.project);
    return ctx.methods.runtimeChange(async () => {
      const target = ctx.instances.targets.find((candidate) => candidate.id === request.target);
      if (!target) throw new WireError("NOT_FOUND", "Execution target is not configured; no session was created.");
      if (request.label !== undefined && (typeof request.label !== "string" || request.label.length > ctx.host.config.limits.labelChars || /\p{Cc}/u.test(request.label))) {
        throw new WireError("INVALID_REQUEST", `Session label must contain at most ${ctx.host.config.limits.labelChars} characters without control characters.`);
      }
      let cwd = request.cwd ?? target.kernel.cwd;
      if (!validSessionCwd(cwd, ctx.host.config.limits) || !isAbsoluteCwd(cwd)) throw new WireError("INVALID_REQUEST", ABSOLUTE_CWD_MESSAGE);
      if (!configurationIssue(target)) await ctx.methods.requireEnvironment(request.target);
      const label = request.label?.trim() || `新会话 ${ctx.host.history.list().length + 1}`;
      const checkedProject = project === undefined ? undefined : resolveProject(ctx, project);
      let manager = cloneSource === undefined
        ? ctx.host.history.create(request.target, label, cwd)
    : ctx.host.history.clone(cloneSource.sessionId, label, cloneEntryId);
      const sessionId = manager.getSessionId();
      try {
        if (checkedProject !== undefined) ctx.host.history.assignProject(sessionId, checkedProject);
        const preparedCwd = await prepare?.(manager);
        if (preparedCwd !== undefined) {
          if (!validSessionCwd(preparedCwd, ctx.host.config.limits) || !isAbsoluteCwd(preparedCwd)) throw new WireError("INVALID_REQUEST", ABSOLUTE_CWD_MESSAGE);
          cwd = preparedCwd;
          ctx.host.history.retarget(sessionId, { target: request.target, cwd });
          manager = ctx.methods.storedSession(sessionId).manager;
        }
        if (checkedProject) rememberProject(ctx, checkedProject, manager.getHeader()?.timestamp);
      }
      catch (error) { ctx.host.history.delete(sessionId); throw error; }
      if (configurationIssue(target)) ctx.host.history.setSleeping(sessionId, true);
      else {
        try { await ctx.host.collection.create(request.target, manager, { cwd }); }
        catch (error) {
          ctx.methods.markUnavailable(sessionId, error instanceof Error ? error.message : String(error), error);
          throw error;
        }
      }
      const entry = ctx.methods.stored(sessionId);
      const session = ctx.methods.managedSessionSnapshot(entry);
      ctx.methods.publish("session_derivation_changed", entry);
      return { session, snapshot: ctx.methods.state(sessionId) };
    });
  }
