import type { ResourceLoader, Skill } from "@earendil-works/pi-coding-agent";
import type { SkillLoaderContext } from "./catalog-types.ts";
import { getSkills } from "./loader/get-skills.ts";

/** Public ResourceLoader adapter: SDK discovery/reload remain owned by the original loader. */
export function filteredSkillLoader(loader: ResourceLoader, skills: () => Skill[], enabled: (skill: Skill) => boolean): ResourceLoader {
  const ctx: SkillLoaderContext = { loader, skills, enabled };
  return {
    getSkills: () => getSkills(ctx),
    getExtensions: () => ctx.loader.getExtensions(),
    getPrompts: () => ctx.loader.getPrompts(),
    getThemes: () => ctx.loader.getThemes(),
    getAgentsFiles: () => ctx.loader.getAgentsFiles(),
    getSystemPrompt: () => ctx.loader.getSystemPrompt(),
    getSystemPromptSource: () => ctx.loader.getSystemPromptSource(),
    getAppendSystemPrompt: () => ctx.loader.getAppendSystemPrompt(),
    getAppendSystemPromptSources: () => ctx.loader.getAppendSystemPromptSources(),
    extendResources: (paths) => ctx.loader.extendResources(paths),
    reload: (options) => ctx.loader.reload(options),
  };
}
