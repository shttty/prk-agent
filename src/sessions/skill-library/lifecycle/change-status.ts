import type { ToolLibraryAction } from "../../../codemode/tool-library/library-types.ts";
import type { SkillLibraryContext, SkillLibraryEntry } from "../skill-types.ts";
import { age } from "./age-records.ts";
import { record as getRecord } from "./get-record.ts";
import { remove } from "./remove-skill.ts";
import { promote } from "./promote-skill.ts";
import { transition } from "./transition-status.ts";
import { bound } from "./enforce-capacity.ts";
import { publish } from "./publish-records.ts";
import { list } from "../catalog/list.ts";

export function change(ctx: SkillLibraryContext, action: ToolLibraryAction, name: string): SkillLibraryEntry[] {
  age(ctx);
  const record = getRecord(ctx, name);
  if (action === "delete") remove(ctx, record);
  else if (action === "promote") promote(ctx, record, true);
  else transition(ctx, record, action === "archive" ? "archived" : "staging");
  bound(ctx); publish(ctx);
  return list(ctx);
}
