import { Value } from "typebox/value";
import { WireError } from "../../../gateway/wire/create-error.ts";
import type { SkillLibraryContext, SkillLibraryEntry } from "../skill-types.ts";
import { scopeSchema } from "../tools/skill-schema.ts";
import { age } from "./age-records.ts";
import { record as getRecord } from "./get-record.ts";
import { publish } from "./publish-records.ts";
import { list } from "../catalog/list.ts";

export function setScope(ctx: SkillLibraryContext, name: string, scope: string): SkillLibraryEntry[] {
  if (!Value.Check(scopeSchema, scope)) throw new WireError("INVALID_REQUEST", "Skill scope must be global, instance:<instance id>, or project:<projectId>, with a nonempty suffix and no control characters.");
  age(ctx);
  const record = getRecord(ctx, name);
  record.scope = scope;
  record.changedAt = new Date(ctx.now()).toISOString();
  publish(ctx);
  return list(ctx);
}
