import { parseLibraryOptions } from "../tools/parse-library-options.ts";
import { DEFAULT_SKILLS_OPTIONS, type SkillsOptions } from "./skills-options.ts";

export function parseSkillsOptions(value: unknown): SkillsOptions {
  return parseLibraryOptions("skills", value, DEFAULT_SKILLS_OPTIONS);
}
