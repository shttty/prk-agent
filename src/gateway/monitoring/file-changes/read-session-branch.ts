import type { HostContext } from "../../host/host-state.ts";
import type { SessionManager } from "@earendil-works/pi-coding-agent";

export function branchOf(ctx: HostContext, sessionId: string): ReturnType<SessionManager["getBranch"]> { return ctx.host.history.get(sessionId)?.manager.getBranch() ?? []; }
