import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import { WireError } from "../../wire/create-error.ts";

export async function renameSession(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["renameSession"]>[0], label: Parameters<GatewaySessionHost["renameSession"]>[1]): ReturnType<GatewaySessionHost["renameSession"]> {
      if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down.");
      ctx.methods.storedSession(sessionId);
      ctx.host.history.rename(sessionId, label.trim());
      const entry = ctx.methods.storedSession(sessionId);
      ctx.methods.publish("session_renamed", entry);
      return ctx.methods.managedSessionSnapshot(entry);
    }
