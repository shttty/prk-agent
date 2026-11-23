import type { HostContext } from "../../host/host-state.ts";
import type { StoredSession } from "../../../sessions/history/history-types.ts";
import type { SessionHostSnapshot } from "../../../sessions/host/host-types.ts";
import { readNativeSessionState } from "../../../sessions/history/read-native-session-state.ts";
import { projectHistoryPage } from "../history/project-history-page.ts";
import { listCellDeliveries } from "../../../sessions/history/kernel-cells/read-deliveries.ts";

export function archivedSnapshot(ctx: HostContext, entry: StoredSession, includeHistory = true): SessionHostSnapshot {
  const nativeState = readNativeSessionState(entry.manager, ctx.host.config.limits);
  const kernelCells = listCellDeliveries(entry.manager);
    return Object.freeze({
      sessionId: entry.sessionId,
      ...ctx.methods.archivedStream(entry),
      sequence: 0,
   requiresReload: false,
   ...(ctx.models.modelFallbacks.get(entry.sessionId) ? { modelFallback: ctx.models.modelFallbacks.get(entry.sessionId) } : {}),
   ...(nativeState.model === undefined ? {} : { model: nativeState.model }),
   ...(nativeState.thinkingLevel === undefined ? {} : { thinkingLevel: nativeState.thinkingLevel }),
   toolMode: nativeState.toolMode ?? ctx.host.config.session.workerTools,
   kernelLanguage: nativeState.kernelLanguage ?? "python",
   delegation: nativeState.delegation ?? ctx.host.config.session.delegation,
   localTools: nativeState.localTools ?? (ctx.instances.targets.find((target) => target.id === entry.target)?.local === true && ctx.capabilities.capabilityDefaults.localTools),
   scopedModels: nativeState.scopedModels,
   historyThrough: entry.manager.getLeafId(),
   ...(includeHistory ? projectHistoryPage(ctx, entry.manager) : { messages: [] }),
   ...(kernelCells.length ? { kernelCells } : {}),
   queuedMessages: { steering: [], followUp: [] },
    });
  }
