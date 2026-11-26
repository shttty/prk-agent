import type { StoreContext } from "../store-context-types.ts";
import type { BannerTags, Tone } from "../store-types.ts";
import { patchSession } from "../updates/patch-session.ts";

export function setBanner(ctx: StoreContext, text: string | null, tone: Tone = "warning", tags: BannerTags = {}) {
  patchSession(ctx, { banner: text ? { ...tags, text, tone } : null });
}
