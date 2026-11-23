import { Type } from "typebox";

export const gatewayRequest = Type.Object({ name: Type.String(), args: Type.Record(Type.String(), Type.Unknown()), result: Type.Optional(Type.Literal("file")) }, { additionalProperties: false });
export const describeRequest = Type.Object({ name: Type.Optional(Type.Union([Type.String(), Type.Null()])) });
