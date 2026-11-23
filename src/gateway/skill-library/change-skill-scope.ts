import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";

export function skillsScope(ctx: HostContext, name: Parameters<GatewaySessionHost["skillsScope"]>[0], scope: Parameters<GatewaySessionHost["skillsScope"]>[1]): ReturnType<GatewaySessionHost["skillsScope"]> {
      const skills = ctx.host.skillLibrary.setScope(name, scope);
      for (const entry of ctx.host.history.listAll()) if (ctx.host.collection.get(entry.sessionId)) ctx.methods.publishCapabilities(entry.sessionId);
      return { skills };
    }
