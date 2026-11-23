import type { ToolLibraryContext } from "../library-state.ts";
import { transition } from "./transition-tool.ts";
import { score } from "./rank-tool.ts";
import { promote } from "./promote-tool.ts";
import { bound } from "./enforce-capacity.ts";
import { publish } from "../observation/publish-library.ts";

export function age(ctx: ToolLibraryContext): void {
  const before = JSON.stringify(ctx.records);
  const cutoff = ctx.now();
  for (const record of ctx.records) {
    if (record.status === "archived" || record.manual) continue;
    const days = ctx.options[record.status].idleDays;
    // A demotion starts a new staging competition period even if last use was long ago.
    const activity = Math.max(Date.parse(record.lastUsedAt ?? record.createdAt), Date.parse(record.changedAt));
    if (cutoff - activity >= days * 86_400_000) transition(ctx, record, record.status === "staging" ? "archived" : "staging");
  }
  for (const record of ctx.records.filter((item) => item.status === "staging" && item.promotionReady).sort((a, b) => score(ctx, b, a))) promote(ctx, record, false);
  bound(ctx);
  if (before !== JSON.stringify(ctx.records)) publish(ctx);
}
