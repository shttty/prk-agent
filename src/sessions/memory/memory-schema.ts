import { Type } from "typebox";

/** Layer names come from localmemory.toml; the store checks them against the current configuration. */
export const targetSchema = Type.String({ minLength: 1, maxLength: 32 });
const entrySchema = Type.String({ minLength: 1, pattern: "\\S" });
const operationBranches = [
  Type.Object({ target: targetSchema, action: Type.Literal("add"), content: entrySchema, old_text: Type.Optional(entrySchema) }, { additionalProperties: false }),
  Type.Object({ target: targetSchema, action: Type.Literal("replace"), content: entrySchema, old_text: entrySchema }, { additionalProperties: false }),
  Type.Object({ target: targetSchema, action: Type.Literal("remove"), content: Type.Optional(entrySchema), old_text: entrySchema }, { additionalProperties: false }),
] as const;
export const MEMORY_OPERATION_SCHEMA = Type.Union([...operationBranches]);
export const MEMORY_REQUEST_SCHEMA = Type.Union([
  ...operationBranches,
  Type.Object({ operations: Type.Array(MEMORY_OPERATION_SCHEMA, { minItems: 1 }) }, { additionalProperties: false }),
]);
