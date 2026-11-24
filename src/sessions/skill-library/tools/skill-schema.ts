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

const descriptionSchema = textField(1024);
const whenSchema = textField(4096);
const evidenceSchema = textField(8192);
const procedureSchema = stepsSchema(1);
const pitfallsSchema = stepsSchema(0);
const verificationSchema = stepsSchema(0);

export const manageSchema = Type.Union([
  Type.Object({ action: Type.Literal("create"), name: nameSchema, scope: createScopeSchema, description: descriptionSchema, whenToUse: whenSchema, evidence: evidenceSchema, procedure: procedureSchema, pitfalls: pitfallsSchema, verification: verificationSchema }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("patch"), name: nameSchema, section: Type.Literal("description"), value: descriptionSchema }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("patch"), name: nameSchema, section: Type.Literal("whenToUse"), value: whenSchema }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("patch"), name: nameSchema, section: Type.Literal("evidence"), value: evidenceSchema }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("patch"), name: nameSchema, section: Type.Literal("procedure"), value: procedureSchema }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("patch"), name: nameSchema, section: Type.Literal("pitfalls"), value: pitfallsSchema }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("patch"), name: nameSchema, section: Type.Literal("verification"), value: verificationSchema }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("patch"), name: nameSchema, section: Type.Literal("scope"), value: scopeSchema }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("write_file"), name: nameSchema, path: Type.String({ description: "Skill-relative path (not SKILL.md)" }), content: Type.String() }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("remove_file"), name: nameSchema, path: Type.String() }, { additionalProperties: false }),
  Type.Object({ action: Type.Literal("delete"), name: nameSchema }, { additionalProperties: false }),
]);

export const manageResultSchema = Type.Union([
  Type.Object({ deleted: nameSchema }, { additionalProperties: false }),
  Type.Object({ skill: Type.Object({
    name: nameSchema, scope: scopeSchema, description: descriptionSchema, whenToUse: whenSchema, evidence: evidenceSchema,
    status: storedSchema.properties.status, manual: storedSchema.properties.manual,
    distinctSessions: Type.Integer({ minimum: 0 }), lastUsedAt: storedSchema.properties.lastUsedAt,
    content: Type.String(), body: Type.String(), files: Type.Array(Type.String()),
  }, { additionalProperties: false }) }, { additionalProperties: false }),
]);
