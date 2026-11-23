import type { HostContext } from "../../host/host-state.ts";
import type { SessionHostSnapshot } from "../../../sessions/host/host-types.ts";
import { projectHistoryPage } from "../history/project-history-page.ts";
import { listCellDeliveries } from "../../../sessions/history/kernel-cells/read-deliveries.ts";

export function decorateSnapshot(ctx: HostContext, sessionId: string, snapshot: SessionHostSnapshot, includeHistory = true): SessionHostSnapshot {
    const entry = ctx.methods.storedSession(sessionId);
  const runtime = ctx.host.collection.get(sessionId);
  const manager = runtime?.session.sessionManager ?? entry.manager;
  const kernelCells = listCellDeliveries(manager, snapshot.kernel?.activeCells);
  return Object.freeze({
   ...snapshot, historyThrough: manager.getLeafId(),
   ...(includeHistory ? projectHistoryPage(ctx, manager) : { messages: [] }),
   ...(kernelCells.length ? { kernelCells } : {}),
   ...(ctx.models.modelFallbacks.get(sessionId) ? { modelFallback: ctx.models.modelFallbacks.get(sessionId) } : {}),
   ...(runtime ? {
    model: runtime.session.model ? `${runtime.session.model.provider}/${runtime.session.model.id}` : undefined,
    thinkingLevel: runtime.session.thinkingLevel,
    toolMode: runtime.toolMode,
    kernelLanguage: snapshot.kernel?.language ?? "python",
    delegation: runtime.delegation,
    localTools: runtime.localTools,
    scopedModels: runtime.session.scopedModels.map((entry) => `${entry.model.provider}/${entry.model.id}`),
    contextUsage: runtime.session.getContextUsage() ?? null,
    requiresReload: runtime.requiresReload,
   } : {}),
  });
  }
