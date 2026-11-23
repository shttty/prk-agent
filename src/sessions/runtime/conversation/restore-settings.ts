import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { RuntimeContext } from "../runtime-state.ts";
import type { ConversationContext } from "../runtime-state.ts";

export function restoreSettings(ctx: RuntimeContext, conversation: ConversationContext, session: AgentSession): void {
const autoCompaction = conversation.persisted.autoCompaction ?? ctx.dependencies.autoCompaction;
const autoRetry = conversation.persisted.autoRetry ?? ctx.dependencies.autoRetry;
const persistedScopedModels = conversation.persisted.scopedModels ?? ctx.dependencies.scopedModels;
if (autoCompaction !== undefined) session.setAutoCompactionEnabled(autoCompaction);
if (autoRetry !== undefined) session.setAutoRetryEnabled(autoRetry);
if (persistedScopedModels !== undefined) {
        const scopedModels = persistedScopedModels.map((spec) => {
          const separator = spec.indexOf("/");
          const model = separator > 0 ? ctx.dependencies.modelRuntime.getModel(spec.slice(0, separator), spec.slice(separator + 1)) : undefined;
          if (!model || !ctx.dependencies.modelRuntime.getAvailableSnapshot().some((candidate) => candidate.provider === model.provider && candidate.id === model.id)) throw new Error(`Persisted scoped model ${JSON.stringify(spec)} is unavailable.`);
          return { model };
        });
        session.setScopedModels(scopedModels);
      }
}
