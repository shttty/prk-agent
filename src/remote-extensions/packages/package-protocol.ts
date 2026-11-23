import { Type } from "typebox";

export const text = Type.String({ minLength: 1, pattern: "^[^\\u0000-\\u001f\\u007f-\\u009f]+(?![\\s\\S])" });
export const packageSchema = Type.Object({
  name: text, version: text, bundle: text, node: text,
  sha256: Type.String({ minLength: 64, maxLength: 64, pattern: "^[a-f0-9]{64}$" }),
  platform: Type.Union([Type.Literal("x86_64"), Type.Literal("aarch64")]),
  extensions: Type.Array(text, { minItems: 1, uniqueItems: true }),
}, { additionalProperties: false });
