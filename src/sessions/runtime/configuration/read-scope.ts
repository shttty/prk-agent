import type { RuntimeContext } from "../runtime-state.ts";

export function scopeContext(ctx: RuntimeContext) { return ({ instance: ctx.target.id, projectId: ctx.dependencies.projectId?.() }); }
