import { Type } from "typebox";

export const thinking = Type.Union([
  Type.Literal("off"), Type.Literal("minimal"), Type.Literal("low"), Type.Literal("medium"),
  Type.Literal("high"), Type.Literal("xhigh"), Type.Literal("max"),
]);

export const DERIVED_SESSION_TYPE = "gateway-derived-session";

export const DERIVED_DETACHED_TYPE = "gateway-derived-detached";

export const RECEIPT_TYPE = "gateway-derived-receipt";

