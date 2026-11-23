import { resolve } from "node:path";
import type { Skill } from "@earendil-works/pi-coding-agent";
import { skillOrigin } from "../../../resource-catalog/classify-skill-origin.ts";
import { within } from "../../../resource-catalog/is-within-resource-root.ts";
import { targetDirectories } from "../list-target-directories.ts";
import type { RuntimeContext } from "../../runtime-state.ts";

export function origin(ctx: RuntimeContext, skill: Skill) { return skillOrigin(skill, ctx.dependencies.skillLibrary?.directory ?? resolve(ctx.dependencies.agentDir, "../skills"), ctx.dependencies.agentDir,
    ctx.targetSkills.skills.includes(skill) ? targetDirectories(ctx).find(({ path }) => within(path, skill.filePath)) : undefined); }
