import type { RuntimeContext } from "../runtime-state.ts";

export function defaults(ctx: RuntimeContext) { return ctx.dependencies.capabilityDefaults?.(ctx.target.id) ?? { capabilities: { ...ctx.sessionOptions.capabilities, ...ctx.target.capabilities }, localTools: ctx.sessionOptions.localTools }; }
