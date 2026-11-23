import type { skillsList } from "./list-skills.ts";
import type { skillsChange } from "./change-skill.ts";
import type { skillsScope } from "./change-skill-scope.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface SkillLibraryMethods {
  skillsList: WithoutContext<typeof skillsList>;
  skillsChange: WithoutContext<typeof skillsChange>;
  skillsScope: WithoutContext<typeof skillsScope>;
}
