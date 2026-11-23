import { realpathSync } from "node:fs";
import type { Skill } from "@earendil-works/pi-coding-agent";
import { within } from "../../resource-catalog/is-within-resource-root.ts";

export function contains(skill: Skill, remote: boolean | undefined, path: string): boolean {
  return within(remote ? skill.baseDir : realpathSync(skill.baseDir), path);
}
