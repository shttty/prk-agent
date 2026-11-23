import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";
import { WireError } from "../../wire/create-error.ts";

export function kernelVariables(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["kernelVariables"]>[0]): ReturnType<GatewaySessionHost["kernelVariables"]> {
      ctx.methods.storedSession(sessionId);
      const runtime = ctx.host.collection.get(sessionId);
      if (!runtime) throw new WireError("UNAVAILABLE", "An active session runtime is required; variable actions never wake a session.");
      return runtime.kernel.variables();
    }
