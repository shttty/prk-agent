import type { HostContext } from "../host/host-state.ts";
import type { TargetFileContext } from "../../workspace/target-files/files-types.ts";
import { WireError } from "../wire/create-error.ts";

export function workspaceContext(ctx: HostContext, sessionId: string, requireActive = false): TargetFileContext {
    if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down.");
    // `transient` tells clients this BUSY ends by itself once the session settles, so retrying is meaningful.
    if (ctx.lifecycle.transitions.has(sessionId)) throw new WireError("BUSY", "Session is changing; retry once it settles.", { transient: true });
    const entry = ctx.methods.storedSession(sessionId);
    const target = ctx.instances.targets.find((candidate) => candidate.id === entry.target);
    if (!target) throw new WireError("NOT_FOUND", "Session execution target is no longer configured.");
    const live = ctx.host.collection.snapshot().find((candidate) => candidate.sessionId === sessionId);
    if (requireActive && !entry.sleeping && (!live || live.state === "closed" || live.state === "closing")) {
      throw new WireError("INVALID_REQUEST", "Session is closed; recover it before opening a terminal.");
    }
    return { target: target.id, sessionId, cwd: entry.cwd };
  }
