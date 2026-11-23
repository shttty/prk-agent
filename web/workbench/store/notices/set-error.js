import { patchSession } from "../updates/patch-session.js";
export function setError(ctx, text) {
    patchSession(ctx, { error: text ? String(text) : null });
  }

