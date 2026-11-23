import type { SkillLibraryContext } from "../skill-types.ts";
import { score } from "./rank-usage.ts";
import { transition } from "./transition-status.ts";
import { remove } from "./remove-skill.ts";

export function bound(ctx: SkillLibraryContext): void {
  const promoted = ctx.records.filter((item) => item.status === "promoted");
  for (const record of promoted.filter((item) => !item.manual).sort((a, b) => score(ctx, a, b)).slice(0, Math.max(0, promoted.length - ctx.options.promoted.capacity))) transition(ctx, record, "staging");
  const staging = ctx.records.filter((item) => item.status === "staging").sort((a, b) => score(ctx, a, b));
  for (const record of staging.slice(0, Math.max(0, staging.length - ctx.options.staging.capacity))) transition(ctx, record, "archived");
  const archived = ctx.records.filter((item) => item.status === "archived").sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt));
  for (const record of archived.slice(0, Math.max(0, archived.length - ctx.options.archive.capacity))) remove(ctx, record);
}
