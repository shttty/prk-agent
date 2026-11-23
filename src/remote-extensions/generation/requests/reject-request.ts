import type { RequestContext } from "../generation-types.ts";
import { settleRequest } from "./settle-request.ts";

export function rejectRequest(ctx: RequestContext, error: Error): void {
  settleRequest(ctx, error);
}
