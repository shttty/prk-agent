import type { SkillDirectory } from "../../resource-catalog/catalog-types.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function targetDirectories(ctx: RuntimeContext): SkillDirectory[] { return ctx.targetSkills.directories
    .filter(({ path }) => !(ctx.target.local && path === ctx.gatewayAgents))
    .map(({ path }) => ({ path, local: ctx.target.local, machine: ctx.target.id })); }
