import { Type } from "typebox";

const entrySchema = Type.Object({
  sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
  size: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  addedAt: Type.String(),
  minGlibc: Type.Optional(Type.String({ pattern: "^\\d+(?:\\.\\d+)+$" })),
}, { additionalProperties: false });
const versionSchema = Type.Object({ platforms: Type.Object({
  x86_64: Type.Optional(entrySchema), aarch64: Type.Optional(entrySchema),
}, { additionalProperties: false }) }, { additionalProperties: false });
export const manifestSchema = Type.Object({ tools: Type.Record(Type.String(), Type.Object({
  current: Type.String(), versions: Type.Record(Type.String(), versionSchema),
}, { additionalProperties: false })) }, { additionalProperties: false });
