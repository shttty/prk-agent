import type { HostContext } from "../../host/host-state.ts";
import type { NativeTarget } from "../../../sessions/native-interaction/native-types.ts";
import { WireError } from "../../wire/create-error.ts";
import type { SessionManager } from "@earendil-works/pi-coding-agent";

export async function runNativeLifecycle(ctx: HostContext, target: NativeTarget, action: "new" | "clone" | "fork", args?: Record<string, unknown>): Promise<unknown> {
    const entry = ctx.methods.storedSession(target.sessionId);
  const entryId = action === "fork" && typeof args?.entryId === "string" ? args.entryId.trim() : undefined;
  if (action === "fork" && !entryId) throw new WireError("INVALID_REQUEST", "Fork requires a persisted assistant reply entry ID.");
  const cloneSource = action === "clone" || action === "fork" ? entry : undefined;
  const label = action === "fork" ? `${entry.label.slice(0, Math.min(ctx.host.config.limits.forkLabelChars, Math.max(0, ctx.host.config.limits.labelChars - " · 分支".length)))} · 分支` : undefined;
    const project = (manager: SessionManager) => {
      if (entry.projectId !== undefined && entry.projectName !== undefined) {
        manager.appendCustomEntry("gateway-session-project", { version: 1, project: { id: entry.projectId, name: entry.projectName } });
      }
    };
    const created = await ctx.methods.createManagedSession({ target: entry.target, cwd: entry.cwd, ...(label ? { label } : {}) }, project, cloneSource, entryId);
  return { ...created, selected: true, ...(cloneSource ? { clonedFrom: entry.sessionId, sourceSessionId: entry.sessionId, ...(entryId ? { forkEntryId: entryId } : {}), pythonMemoryCopied: false } : {}) };
  }
