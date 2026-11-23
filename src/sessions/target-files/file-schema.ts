import { Type } from "typebox";
import FILE_LIMITS from "../../target-channel/target-files/file-limits.json" with { type: "json" };
const text = Type.String({ pattern: "^[^\\u0000]*$" });
const path = Type.String({ minLength: 1, pattern: "^[^\\u0000]+$", description: "Target-machine file path, relative to the session working directory or absolute." });
export const readSchema = Type.Object({
  path,
  offset: Type.Optional(Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER, description: "First line to return (1-based)." })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: FILE_LIMITS.MAX_READ_LINES, description: "Maximum lines to return (default 2000); output is also limited to 50 KiB." })),
}, { additionalProperties: false });
export const editSchema = Type.Object({
  path,
  edits: Type.Array(Type.Object({
    oldText: Type.String({ pattern: "^[^\\u0000]*$", description: "Exact, unique text in the file after previous edits in this call. Empty only for an empty file." }),
    newText: text,
  }, { additionalProperties: false }), { minItems: 1 }),
}, { additionalProperties: false });
export const writeSchema = Type.Object({ path, content: text }, { additionalProperties: false });
export const resultSchema = Type.Object({
  content: Type.Array(Type.Object({ type: Type.Literal("text"), text: Type.String() }, { additionalProperties: false })),
  details: Type.Object({
    diff: Type.Optional(Type.String()),
    patch: Type.Optional(Type.String()),
    firstChangedLine: Type.Optional(Type.Integer({ minimum: 1 })),
    hash: Type.Optional(Type.String({ pattern: "^[0-9a-f]{64}$" })),
    path: Type.String({ minLength: 1, pattern: "^/" }),
  }, { additionalProperties: false }),
  re: Type.Optional(Type.Integer()),
}, { additionalProperties: false });
