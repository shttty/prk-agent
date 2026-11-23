import { REFRESH_TOOLS } from "../../monitoring/monitor-constants.ts";
import { projectToolEvent } from "../../tool-content/format-event.ts";
import type { HostBindingContext } from "../host-binding-state.ts";
import { emit } from "../subscription/publish-host-event.ts";
import { snapshot } from "../subscription/read-host-snapshot.ts";
import { projectKernelCellEvent } from "../subscription/format-kernel-cell-event.ts";

export function refresh(ctx: HostBindingContext, publishSnapshot = false): void {
  const current = ctx.parent.methods.storedSession(ctx.sessionId);
  const candidate = current.sleeping ? undefined : ctx.parent.host.collection.get(ctx.sessionId)?.host;
  const next = candidate === ctx.fenced ? undefined : candidate;
  if (candidate !== ctx.fenced) ctx.fenced = undefined;
  if (ctx.original === next && !publishSnapshot) return;
  if (ctx.original !== next) {
    (0, ctx.unsubscribe)?.();
    ctx.original = next;
    if (next) ctx.parent.views.archivedStreamIds.delete(current.sessionId);
    ctx.source = next;
    ctx.binding.idleSince = undefined;
    ctx.unsubscribe = ctx.source?.subscribe((event) => {
      ctx.binding.idleSince = undefined;
      if (event.type === "session_event" && event.details?.sdkType === "tool_execution_end" && REFRESH_TOOLS.includes(String(event.details.toolName))) ctx.parent.monitoring.monitor.refresh(ctx.sessionId);
      if (event.type === "snapshot") emitSnapshot(ctx);
      else emit(ctx, projectToolEvent(projectKernelCellEvent(ctx, event), ctx.parent.host.config.toolContent));
      // Persisted messages and entry IDs are available to pull at this operation boundary.
      if (event.type === "operation_completed") emitSnapshot(ctx);
    }).unsubscribe;
  }
  emitSnapshot(ctx);
}

function emitSnapshot(ctx: HostBindingContext): void {
  const { messages: _, ...observation } = snapshot(ctx, false);
  emit(ctx, {
    type: "snapshot", sessionId: observation.sessionId, streamId: observation.streamId, sequence: observation.sequence,
    timestamp: new Date().toISOString(), details: { snapshot: observation }
  });
}
