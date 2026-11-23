import type { SkillDirectory } from "../catalog-types.ts";

export function skillDirectoryGroup({ path, machine, home }: SkillDirectory): string {
  if (home) return "group:skills:global";
  return `group:skills:dir:${machine}:${path}`;
}
