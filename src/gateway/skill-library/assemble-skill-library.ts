import { skillsList } from "./list-skills.ts";
import { skillsChange } from "./change-skill.ts";
import { skillsScope } from "./change-skill-scope.ts";
import type { HostContext } from "../host/host-state.ts";
import type { SkillLibraryMethods } from "./skill-library-methods.ts";

export function assembleSkillLibrary(ctx: HostContext): SkillLibraryMethods {
  return {
    skillsList: skillsList.bind(undefined, ctx),
    skillsChange: skillsChange.bind(undefined, ctx),
    skillsScope: skillsScope.bind(undefined, ctx),
  };
}
