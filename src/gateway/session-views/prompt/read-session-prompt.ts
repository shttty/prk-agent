import type { HostContext } from "../../host/host-state.ts";
import type { GatewaySessionHost } from "../../host/host-types.ts";

/** A sleeping session has no runtime and so no capture: it reads as empty, and is never woken for this. */
export function sessionPrompt(ctx: HostContext, sessionId: Parameters<GatewaySessionHost["sessionPrompt"]>[0]): ReturnType<GatewaySessionHost["sessionPrompt"]> {
  ctx.methods.storedSession(sessionId);
  const report = ctx.host.collection.get(sessionId)?.promptReport() ?? { latest: null, previousAt: null, diff: null };
  return { sessionId, ...report };
}
