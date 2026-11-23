import type { SkillLibraryContext, StoredSkill } from "../skill-types.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";

export function record(ctx: SkillLibraryContext, name: string): StoredSkill {
  const record = ctx.records.find((item) => item.name === name);
  if (!record) throw new WireError("NOT_FOUND", `Unknown shared skill ${JSON.stringify(name)}.`);
  return record;
}
