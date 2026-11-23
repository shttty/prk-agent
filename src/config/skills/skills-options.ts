import { DEFAULT_TOOLS_OPTIONS, type ToolsOptions } from "../tools/tools-options.ts";

export type SkillsOptions = Omit<ToolsOptions, "versionsKept">;
export const DEFAULT_SKILLS_OPTIONS: SkillsOptions = Object.freeze({
  staging: DEFAULT_TOOLS_OPTIONS.staging,
  promoted: DEFAULT_TOOLS_OPTIONS.promoted,
  promotion: DEFAULT_TOOLS_OPTIONS.promotion,
  archive: DEFAULT_TOOLS_OPTIONS.archive,
});
