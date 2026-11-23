import { Type } from "typebox";

export const executionSchema = Type.Object({ args: Type.Optional(Type.Array(Type.Unknown())), kwargs: Type.Optional(Type.Record(Type.String(), Type.Unknown())) }, { additionalProperties: false });
