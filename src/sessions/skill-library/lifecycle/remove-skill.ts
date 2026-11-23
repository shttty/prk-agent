import { rmSync } from "node:fs";
import { join } from "node:path";
import type { SkillLibraryContext, StoredSkill } from "../skill-types.ts";
import { path as resolveOwnedPath } from "../documents/resolve-owned-path.ts";

export function remove(ctx: SkillLibraryContext, record: StoredSkill): void {
  resolveOwnedPath(ctx, record.name, "SKILL.md");
  rmSync(join(ctx.directory, record.name), { recursive: true });
  ctx.records = ctx.records.filter((item) => item !== record);
}
