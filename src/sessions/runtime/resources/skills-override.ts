import type { ResourceDiagnostic } from "@earendil-works/pi-coding-agent";
import type { Skill } from "@earendil-works/pi-coding-agent";
import { preserveGatewaySkillCandidates } from "../../resource-catalog/preserve-gateway-skill-candidates.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function skillsOverride(ctx: RuntimeContext, cwd: string, agentDir: string, neutralCwd: string, base: { skills: Skill[]; diagnostics: ResourceDiagnostic[] }) {
            const global = preserveGatewaySkillCandidates(base, ctx.targetResources ? neutralCwd : cwd, agentDir);
            return ctx.targetResources ? { skills: [...ctx.targetSkills.skills, ...global.skills], diagnostics: [...global.diagnostics, ...ctx.targetSkills.diagnostics.map((diagnostic) => ({ ...diagnostic, type: "warning" as const }))] } : global;
          }
