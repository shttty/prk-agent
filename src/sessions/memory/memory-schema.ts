import { Type } from "typebox";

/** Layer names come from localmemory.toml; the store checks them against the current configuration. */
export const targetSchema = Type.String({ minLength: 1, maxLength: 32 });
const entry = { minLength: 1, pattern: "\\S" };
const memoryOperation = Type.Object({
  target: targetSchema,
  action: Type.Enum(["add", "replace", "remove"]),
  content: Type.Optional(Type.String({ ...entry, description: "New entry for add/replace" })),
  old_text: Type.Optional(Type.String({ ...entry, description: "Unique substring for replace/remove" })),
}, { additionalProperties: false });
export const MEMORY_REQUEST_SCHEMA = Type.Object({ operations: Type.Array(memoryOperation, { minItems: 1 }) }, { additionalProperties: false });
