import type { Skill } from "@earendil-works/pi-coding-agent";

export interface TargetSkills {
  directories: Array<{ path: string }>;
  skills: Skill[];
  diagnostics: Array<{ path: string; message: string }>;
}

export type Entry = { path: string; frontmatter?: string; error?: string };
export type Scan = { path: string; error?: string };
