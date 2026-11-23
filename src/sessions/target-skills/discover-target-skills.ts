import type { TargetLease } from "../../target-channel/lease/lease-types.ts";
import { targetSkillsFromReply } from "./parse-target-skills-reply.ts";
import type { TargetSkills } from "./skill-types.ts";

export async function discoverTargetSkills(lease: TargetLease, cwd: string): Promise<TargetSkills> {
  return targetSkillsFromReply(await lease.request("skills", "discover", { cwd }));
}
