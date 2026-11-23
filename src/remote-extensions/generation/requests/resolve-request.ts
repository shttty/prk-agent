import type { RequestContext } from "../generation-types.ts";
import { settleRequest } from "./settle-request.ts";

export function resolveRequest(ctx: RequestContext, value: unknown): void {
  settleRequest(ctx, undefined, value);
}
