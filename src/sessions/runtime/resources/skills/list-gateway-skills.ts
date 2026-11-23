import { agentsSkillAllowed } from "../../../resource-catalog/is-agents-skill-allowed.ts";
import { agentsSkillDirectory } from "../../../resource-catalog/find-agents-skill-directory.ts";
import type { RuntimeContext } from "../../runtime-state.ts";

export function gatewaySkills(ctx: RuntimeContext) { return (ctx.unfilteredLoader?.getSkills().skills ?? []).filter((skill) => skill.sourceInfo.source !== "target" && agentsSkillAllowed(skill) && !(skill.sourceInfo.scope === "project" && agentsSkillDirectory(skill.filePath))); }
