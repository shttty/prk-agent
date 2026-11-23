import type { SkillLibraryContext, StoredSkill } from "../skill-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { score } from "./rank-usage.ts";
import { transition } from "./transition-status.ts";

export function promote(ctx: SkillLibraryContext, record: StoredSkill, manual: boolean): void {
  if (record.status === "promoted") { record.manual ||= manual; return; }
  const promoted = ctx.records.filter((item) => item.status === "promoted");
  if (promoted.length >= ctx.options.promoted.capacity) {
    const victim = promoted.filter((item) => !item.manual).sort((a, b) => score(ctx, a, b))[0];
    if (!victim) {
      if (manual) throw new WireError("BUSY", "Promoted capacity is occupied by manually promoted skills; demote or archive one first.");
      return;
    }
    if (!manual && score(ctx, record, victim) <= 0) return;
    transition(ctx, victim, "staging");
  }
  transition(ctx, record, "promoted", manual);
}
