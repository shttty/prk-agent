import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";
import { resolveProject } from "./resolve-project.ts";
import { rememberProject } from "./remember-project.ts";

export function assignProject(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["assignProject"]>[0], project: Parameters<GatewaySessionHost["assignProject"]>[1]): ReturnType<GatewaySessionHost["assignProject"]> {
      ctx.methods.storedSession(sessionId);
      const membership = resolveProject(ctx, project);
      if (membership) rememberProject(ctx, membership);
      const updated = ctx.host.history.assignProject(sessionId, membership);
      ctx.methods.publish("session_project_assigned", updated);
      return ctx.methods.managedSessionSnapshot(ctx.methods.storedSession(sessionId));
    }
