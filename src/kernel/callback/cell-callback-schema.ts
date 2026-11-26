import { Type, type Static } from "typebox";

export const gatewayRequest = Type.Object({ name: Type.String(), args: Type.Record(Type.String(), Type.Unknown()), result: Type.Optional(Type.Literal("file")) }, { additionalProperties: false });
/** gateway.describe() sends nothing, describe(name) a name, search(query, limit) a query; the Gateway answers all three on this channel. */
export const describeRequest = Type.Object({
  name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  query: Type.Optional(Type.String({ minLength: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
});
export type GatewayDescribeRequest = Static<typeof describeRequest>;
