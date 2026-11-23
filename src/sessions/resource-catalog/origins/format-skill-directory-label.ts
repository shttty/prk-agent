import type { SkillDirectory } from "../catalog-types.ts";

export function skillDirectoryLabel({ path, machine, home, local }: SkillDirectory): string {
  if (home) return "全局 · ~/.agents/skills";
  return `${path} · ${local || machine === "gateway" ? "本机" : machine}`;
}
