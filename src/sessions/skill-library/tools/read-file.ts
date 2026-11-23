import type { SkillTarget } from "../skill-types.ts";
import { readTargetSkill } from "../../target-skills/read-target-skill.ts";

export function readFile(target: SkillTarget | undefined, path: string) {
  const lease = target?.lease();
  if (!lease) throw new Error("Target skill channel is unavailable.");
  return readTargetSkill(lease, path);
}
