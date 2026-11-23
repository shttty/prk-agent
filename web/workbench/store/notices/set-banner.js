import { patchSession } from "../updates/patch-session.js";
export function setBanner(ctx, text, tone = "warning", tags = {}) {
    patchSession(ctx, { banner: text ? { ...tags, text: String(text), tone } : null });
  }

