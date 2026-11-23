import type { PromptTemplate } from "@earendil-works/pi-coding-agent";
import type { TargetSkills } from "../target-skills/skill-types.ts";

export interface TargetResources {
  agentsFiles: Array<{ path: string; content: string }>;
  settings?: string;
  prompts: PromptTemplate[];
  extensions: string[];
  skills: TargetSkills;
}

export interface TargetSettingsContext {
  global: string | undefined;
  project: string | undefined;
}
