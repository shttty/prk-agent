import type { SkillLibraryContext, StoredSkill } from "../skill-types.ts";

export function score(ctx: SkillLibraryContext, a: StoredSkill, b: StoredSkill): number {
  return a.sessions.length - b.sessions.length || Date.parse(a.lastUsedAt ?? a.createdAt) - Date.parse(b.lastUsedAt ?? b.createdAt);
}
