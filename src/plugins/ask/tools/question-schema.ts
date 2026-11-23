import { Type } from "typebox";
const optionSchema = Type.Object({
  label: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String()),
  preview: Type.Optional(Type.String({ description: "Markdown shown while this option is focused." })),
}, { additionalProperties: false });
const questionSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  question: Type.String({ minLength: 1 }),
  header: Type.Optional(Type.String({ description: "Short tab label." })),
  options: Type.Array(optionSchema),
  multi: Type.Optional(Type.Boolean({ description: "true lets the user select several options." })),
  recommended: Type.Optional(Type.Integer({ minimum: 0, description: "Integer, 0-based index into `options` of the suggested option (0 is the first, 1 the second); never the option's label text." })),
}, { additionalProperties: false });
export const askSchema = Type.Object({ questions: Type.Array(questionSchema, { minItems: 1 }) }, { additionalProperties: false });
