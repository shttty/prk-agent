import { WireError } from "../../gateway/wire/create-error.ts";

export const unavailable = (): WireError => new WireError(
  "CLIENT_ERROR",
  "Gateway is unavailable; sessions are owned by the Gateway and this web service never starts a substitute host.",
);
