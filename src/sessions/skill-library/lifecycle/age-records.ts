import type { SkillLibraryContext } from "../skill-types.ts";
import { transition } from "./transition-status.ts";
import { score } from "./rank-usage.ts";
import { promote } from "./promote-skill.ts";
import { bound } from "./enforce-capacity.ts";
import { publish } from "./publish-records.ts";

export function age(ctx: SkillLibraryContext): void {
  const before = JSON.stringify(ctx.records);
  for (const record of ctx.records) {
    if (record.status === "archived" || record.manual) continue;
    const activity = Math.max(Date.parse(record.lastUsedAt ?? record.createdAt), Date.parse(record.changedAt));
    if (ctx.now() - activity >= ctx.options[record.status].idleDays * 86_400_000) transition(ctx, record, record.status === "promoted" ? "staging" : "archived");
  }
  for (const record of ctx.records.filter((item) => item.status === "staging" && item.promotionReady).sort((a, b) => score(ctx, b, a))) promote(ctx, record, false);
  bound(ctx);
  if (before !== JSON.stringify(ctx.records)) publish(ctx);
}
