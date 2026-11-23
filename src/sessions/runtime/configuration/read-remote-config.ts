import type { RuntimeContext } from "../runtime-state.ts";

export function remoteConfiguration(ctx: RuntimeContext) { return ctx.dependencies.remoteExtensions?.(ctx.target.id) ?? { packages: [] }; }
