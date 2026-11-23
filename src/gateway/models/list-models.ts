import type { HostContext } from "../host/host-state.ts";
import type { ModelCatalog } from "./model-types.ts";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";

export async function modelCatalog(ctx: HostContext): Promise<ModelCatalog> {
  const base = await ctx.methods.runtimeBase();
  return {
   models: base.modelRuntime.getAvailableSnapshot().map((model) => ({
    value: `${model.provider}/${model.id}`, label: model.name || model.id, provider: model.provider,
    thinkingLevels: getSupportedThinkingLevels(model), contextWindow: model.contextWindow,
   })),
   defaultModel: ctx.host.options.model, defaultThinkingLevel: base.thinkingLevel,
  };
 }
