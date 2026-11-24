import { Type } from "typebox";

const optionSchema = Type.Object({
  label: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  preview: Type.Optional(Type.String()),
}, { additionalProperties: false });

const questionSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  question: Type.String({ minLength: 1 }),
  header: Type.Optional(Type.String()),
  options: Type.Array(optionSchema),
  multi: Type.Optional(Type.Boolean()),
  recommended: Type.Optional(Type.Integer({ minimum: 0, description: "0-based option index (not label)" })),
}, { additionalProperties: false });

export const askSchema = Type.Object({ questions: Type.Array(questionSchema, { minItems: 1 }) }, { additionalProperties: false });
