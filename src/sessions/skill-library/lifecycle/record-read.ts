import type { SkillLibraryContext } from "../skill-types.ts";
import { join } from "node:path";
import { age } from "./age-records.ts";
import { promote } from "./promote-skill.ts";
import { bound } from "./enforce-capacity.ts";
import { publish } from "./publish-records.ts";

export function recordRead(ctx: SkillLibraryContext, absolutePath: string, sessionId: string): void {
  age(ctx);
  const record = ctx.records.find((item) => item.status !== "archived" && absolutePath === join(ctx.directory, item.name, "SKILL.md"));
  if (!record) return;
  if (!record.sessions.includes(sessionId)) record.sessions.push(sessionId);
  record.lastUsedAt = new Date(ctx.now()).toISOString();
  if (record.status === "staging" && record.sessions.length >= ctx.options.promotion.distinctSessions) {
    record.promotionReady = true;
    promote(ctx, record, false);
  }
  bound(ctx); publish(ctx);
}
