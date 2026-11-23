import { Type } from "typebox";

export const metadataSchema = Type.Object({
  name: Type.String({ pattern: "^[A-Za-z_][A-Za-z0-9_]*$" }), source: Type.String({ minLength: 1 }),
  signature: Type.String(), docstring: Type.String(), imports: Type.Array(Type.String()), reason: Type.String({ minLength: 1, pattern: "\\S" }),
}, { additionalProperties: false });
export const storedSchema = Type.Object({
  ...metadataSchema.properties,
  version: Type.Integer({ minimum: 1 }), status: Type.Union([Type.Literal("staging"), Type.Literal("promoted"), Type.Literal("archived")]),
  manual: Type.Boolean(), promotionReady: Type.Boolean(), sessions: Type.Array(Type.String({ minLength: 1 })), successfulCalls: Type.Integer({ minimum: 0 }),
  createdAt: Type.String(), changedAt: Type.String(), lastUsedAt: Type.Optional(Type.String()),
}, { additionalProperties: false });
export const availabilitySchema = Type.Object({ name: Type.String(), version: Type.Integer(), available: Type.Boolean(), unavailableReason: Type.Optional(Type.String()) }, { additionalProperties: false });
