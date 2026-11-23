import type { SkillLoaderContext } from "../catalog-types.ts";

export function getSkills(ctx: SkillLoaderContext) {
  const result = ctx.loader.getSkills();
  const names = new Set<string>();
  return { ...result, skills: ctx.skills().filter((skill) => {
    if (!ctx.enabled(skill) || names.has(skill.name)) return false;
    names.add(skill.name);
    return true;
  }) };
}
