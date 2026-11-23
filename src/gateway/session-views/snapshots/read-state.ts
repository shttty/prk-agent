import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

export function state(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["state"]>[0]): ReturnType<GatewaySessionHost["state"]> {
      const entry = ctx.methods.storedSession(sessionId);
   const snapshot = entry.sleeping || !ctx.host.collection.get(sessionId)
          ? ctx.methods.archivedSnapshot(entry)
        : ctx.methods.sessionHost(sessionId).getSnapshot();
      return Object.freeze({
        ...snapshot,
        ...(entry.projectId === undefined ? {} : { projectId: entry.projectId }),
        ...(entry.projectName === undefined ? {} : { projectName: entry.projectName }),
      });
    }
