import { patchSession } from "../updates/patch-session.js";
import { referenceError } from "./reference-error.js";
export function clearReferenceCandidates(ctx, reason = null) {
    ++ctx.referenceRequestToken;
    if (ctx.state.session.referenceCandidates.value.length || ctx.state.session.referenceCandidates.truncated || ctx.state.session.referenceCandidates.loading || (ctx.state.session.referenceCandidates.error?.reason ?? null) !== reason) patchSession(ctx, { referenceCandidates: { value: [], truncated: false, loading: false, error: reason ? referenceError(reason) : null } });
  }

