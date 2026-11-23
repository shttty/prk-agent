import type { RuntimeContext } from "../runtime-state.ts";

export function directories(ctx: RuntimeContext) { return ctx.targetSkills.directories; }
