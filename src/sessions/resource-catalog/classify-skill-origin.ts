import { homedir } from "node:os";
import { resolve } from "node:path";
import type { Skill } from "@earendil-works/pi-coding-agent";
import type { Origin, SkillDirectory } from "./catalog-types.ts";
import { within } from "./is-within-resource-root.ts";
import { agentsSkillDirectory } from "./find-agents-skill-directory.ts";
import { packageName } from "./origins/read-resource-package-name.ts";
import { skillDirectoryGroup } from "./origins/identify-skill-directory-group.ts";
import { skillDirectoryLabel } from "./origins/format-skill-directory-label.ts";

export function skillOrigin(skill: Skill, shared: string, agentDir: string, target?: SkillDirectory): Origin {
  if (target) return { group: skillDirectoryGroup(target), groupLabel: skillDirectoryLabel(target), source: skill.filePath };
  if (within(shared, skill.filePath)) return { group: "group:skills:shared", groupLabel: "沉淀 Skills", source: skill.filePath };
  if (skill.sourceInfo.origin === "package") {
    const name = packageName(skill.sourceInfo);
    return { group: `group:skills:package:${name}`, groupLabel: name, source: skill.filePath };
  }
  if (within(resolve(agentDir, "skills"), skill.filePath)) return { group: "group:skills:home", groupLabel: "PRK home agent/skills", source: skill.filePath };
  const path = agentsSkillDirectory(skill.filePath) ?? skill.baseDir;
  const directory = { path, machine: "gateway", home: path === resolve(homedir(), ".agents/skills") };
  return { group: skillDirectoryGroup(directory), groupLabel: skillDirectoryLabel(directory), source: skill.filePath };
}
