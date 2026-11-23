import { statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Skill } from "@earendil-works/pi-coding-agent";
import { agentsSkillDirectory } from "./find-agents-skill-directory.ts";
import { SKILL_IGNORED_DIRECTORIES } from "./skill-scan-constants.ts";

/** OpenCode skill-scan: root Markdown, terminal SKILL.md directories, depth <= 6. */
export function agentsSkillAllowed(skill: Skill): boolean {
  if (skill.sourceInfo.origin === "package") return true;
  const root = agentsSkillDirectory(skill.filePath);
  if (!root) return true;
  const parts = relative(root, skill.filePath).split(sep);
  const file = parts.pop()!;
  if (file.startsWith(".") || !file.endsWith(".md") || parts.length > 6 || (parts.length > 0 && file !== "SKILL.md")) return false;
  if (parts.some((part) => part.startsWith(".") || Object.hasOwn(SKILL_IGNORED_DIRECTORIES, part))) return false;
  let directory = root;
  for (let depth = 0; depth <= parts.length; depth++) {
    if ((depth < parts.length || file !== "SKILL.md") && statSync(join(directory, "SKILL.md"), { throwIfNoEntry: false })?.isFile()) return false;
    if (depth < parts.length) directory = join(directory, parts[depth]!);
  }
  return true;
}
