import type { UiContext } from "../ui-types.ts";

export function getAvailableProviderCount(ctx: UiContext) { return new Set((ctx.session.scopedModels.length ? ctx.session.scopedModels.map((item) => item.model) : ctx.session.modelRuntime.getAvailableSnapshot()).map((model) => model.provider)).size; }
