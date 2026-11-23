import type { SkillLibraryContext, StoredSkill } from "../skill-types.ts";

export function transition(ctx: SkillLibraryContext, record: StoredSkill, status: StoredSkill["status"], manual = false): void {
  record.status = status; record.manual = manual; record.promotionReady = false; record.changedAt = new Date(ctx.now()).toISOString();
}
