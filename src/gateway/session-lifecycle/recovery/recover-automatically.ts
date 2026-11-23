import type { HostContext } from "../../host/host-state.ts";
import type { CreatedSession } from "../../session-views/session-view-types.ts";

export async function autoRecover(ctx: HostContext, sessionId: string): Promise<CreatedSession> {
  return ctx.api.recoverSession(sessionId, { mode: "auto" });
 }
