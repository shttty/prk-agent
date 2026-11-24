import type { Static } from "typebox";
import { Value } from "typebox/value";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { type manageSchema, skillSectionSchemas } from "./skill-schema.ts";

type Input = Static<typeof manageSchema>;
const fieldsByAction = {
  create: ["scope", "description", "whenToUse", "evidence", "procedure", "pitfalls", "verification"],
  patch: ["section", "value"],
  write_file: ["path", "content"],
  remove_file: ["path"],
  delete: [],
} as const satisfies Record<Input["action"], readonly (keyof Input)[]>;

type SectionValues = typeof skillSectionSchemas;
type Patch = { [S in keyof SectionValues]: { section: S; value: Static<SectionValues[S]> } }[keyof SectionValues];
type SkillChange = { [A in Input["action"]]: { action: A; name: string } & (
  A extends "patch" ? Patch : Required<Pick<Input, typeof fieldsByAction[A][number]>>
) }[Input["action"]];

/** Pi checks the flat shape; here the action and section determine which fields and limits apply. */
export function validateSkillChange(input: Input): SkillChange {
  const { action, name: _name, ...fields } = input;
  const required: readonly (keyof typeof fields)[] = fieldsByAction[action];
  const missing = required.filter((key) => fields[key] === undefined);
  if (missing.length) throw new WireError("INVALID_REQUEST", `skill_manage ${action} requires: ${missing.join(", ")}.`);
  const extra = (Object.keys(fields) as (keyof typeof fields)[]).filter((key) => !required.includes(key));
  if (extra.length) throw new WireError("INVALID_REQUEST", `skill_manage ${action} does not accept: ${extra.join(", ")}.`);
  const { section, value } = fields;
  if (action === "patch" && section !== undefined) {
    const problems = Value.Errors(skillSectionSchemas[section], value);
    if (problems.length) {
      const { instancePath, message } = problems[0]!;
      throw new WireError("INVALID_REQUEST", `skill_manage patch ${section}: value${instancePath} ${message}.`);
    }
  }
  return input as SkillChange;
}
