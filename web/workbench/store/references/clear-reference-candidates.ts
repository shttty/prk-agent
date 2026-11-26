import type { StoreContext } from "../store-context-types.ts";
import { patchSession } from "../updates/patch-session.ts";
import { referenceError } from "./reference-error.ts";

export function clearReferenceCandidates(ctx: StoreContext, reason: string | null = null) {
  ++ctx.referenceRequestToken;
  const { value, truncated, loading, error } = ctx.state.session.referenceCandidates;
  if (value.length || truncated || loading || (error?.reason ?? null) !== reason) patchSession(ctx, { referenceCandidates: { value: [], truncated: false, loading: false, error: reason ? referenceError(reason) : null } });
}
