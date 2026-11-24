import { Type } from "typebox";

export const FIELD_TYPES = ["string", "number", "boolean", "select", "list"] as const;
const fieldSchema = Type.Object({
  key: Type.String({ minLength: 1, maxLength: 256 }),
  label: Type.String({ minLength: 1, maxLength: 120 }),
  type: Type.Union([Type.Literal("string"), Type.Literal("number"), Type.Literal("boolean"), Type.Literal("select"), Type.Literal("list")]),
  default: Type.Optional(Type.Unknown()),
  options: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 200 }), { maxItems: 100 })),
  description: Type.Optional(Type.String({ maxLength: 1000 })),
  secret: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });
export const sectionSchema = Type.Object({
  title: Type.String({ maxLength: 120 }),
  fields: Type.Array(fieldSchema, { maxItems: 200 }),
}, { additionalProperties: false });
export const PLUGIN_CONFIG_REQUEST_SCHEMA = Type.Object({
  action: Type.Union([Type.Literal("set"), Type.Literal("get")]),
  provider: Type.String({ minLength: 1, maxLength: 200 }),
  file: Type.Optional(Type.String({ minLength: 1, maxLength: 4096, description: "Host absolute JSON path" })),
  sections: Type.Optional(Type.Array(sectionSchema, { maxItems: 50 })),
}, { additionalProperties: false });
export const PLUGIN_CONFIG_RESULT_SCHEMA = Type.Object({
  provider: Type.String(), configured: Type.Boolean(), file: Type.Optional(Type.String()),
  sections: Type.Array(sectionSchema), values: Type.Record(Type.String(), Type.Unknown()),
  exists: Type.Boolean(), secrets: Type.Array(Type.String()),
}, { additionalProperties: false });
