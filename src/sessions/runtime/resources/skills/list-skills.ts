import { within } from "../../../resource-catalog/is-within-resource-root.ts";
import { gatewaySkills } from "./list-gateway-skills.ts";
import type { RuntimeContext } from "../../runtime-state.ts";

export function allSkills(ctx: RuntimeContext) {
    const project = ctx.targetSkills.skills.filter((skill) => !(ctx.target.local && within(ctx.gatewayAgents, skill.filePath)));
    const paths = new Set(project.map((skill) => skill.filePath));
    return [...project, ...gatewaySkills(ctx).filter((skill) => !paths.has(skill.filePath))];
  }
