import { Type } from "typebox";
import { SKILL_SCOPE_PATTERN } from "../../../gateway/wire/scope-constants.ts";
import { SKILL_NAME_PATTERN } from "../skill-constants.ts";
import { textField } from "./create-text-schema.ts";
import { stepsSchema } from "./create-step-schema.ts";

const nameSchema = Type.String({ pattern: SKILL_NAME_PATTERN, minLength: 1, maxLength: 64 });
export const scopeSchema = Type.String({ pattern: SKILL_SCOPE_PATTERN });
const createScopeSchema = Type.String({ pattern: SKILL_SCOPE_PATTERN, description: "global, instance:<id>, or project:<projectId>" });
export const storedSchema = Type.Object({
  name: nameSchema, scope: scopeSchema,
  status: Type.Union([Type.Literal("staging"), Type.Literal("promoted"), Type.Literal("archived")]),
  manual: Type.Boolean(), promotionReady: Type.Boolean(), sessions: Type.Array(Type.String()), createdAt: Type.String(), changedAt: Type.String(), lastUsedAt: Type.Optional(Type.String()),
}, { additionalProperties: false });

export const skillSectionSchemas = {
  description: textField(1024),
  whenToUse: textField(4096),
  evidence: textField(8192),
  procedure: stepsSchema(1),
  pitfalls: stepsSchema(0),
  verification: stepsSchema(0),
  scope: scopeSchema,
};
const { description, whenToUse, evidence, procedure, pitfalls, verification } = skillSectionSchemas;

export const manageSchema = Type.Object({
  action: Type.Enum(["create", "patch", "write_file", "remove_file", "delete"], {
    description: "Create: scope and all six document fields. Patch: section/value. Write file: path/content. Remove file: path.",
  }),
  name: nameSchema,
  scope: Type.Optional(createScopeSchema),
  description: Type.Optional(description),
  whenToUse: Type.Optional(whenToUse),
  evidence: Type.Optional(evidence),
  procedure: Type.Optional(procedure),
  pitfalls: Type.Optional(pitfalls),
  verification: Type.Optional(verification),
  section: Type.Optional(Type.Enum(Object.keys(skillSectionSchemas) as (keyof typeof skillSectionSchemas)[])),
  value: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Patch: match the section's type and limits" })),
  path: Type.Optional(Type.String({ description: "Skill-relative path (not SKILL.md)" })),
  content: Type.Optional(Type.String()),
}, { additionalProperties: false });

export const manageResultSchema = Type.Union([
  Type.Object({ deleted: nameSchema }, { additionalProperties: false }),
  Type.Object({ skill: Type.Object({
    name: nameSchema, scope: scopeSchema, description, whenToUse, evidence,
    status: storedSchema.properties.status, manual: storedSchema.properties.manual,
    distinctSessions: Type.Integer({ minimum: 0 }), lastUsedAt: storedSchema.properties.lastUsedAt,
    content: Type.String(), body: Type.String(), files: Type.Array(Type.String()),
  }, { additionalProperties: false }) }, { additionalProperties: false }),
]);
