import type { ScrollSampler, StoreContext } from "../store-context-types.ts";

const SCROLL_IDLE_MS = 200;

/** Scroll position is not render state: keep only the latest sampler and persist it once scrolling stops (see flushScroll). */
export function noteScroll(ctx: StoreContext, sample: ScrollSampler) {
  ctx.scrollSample = sample;
  clearTimeout(ctx.scrollTimer);
  ctx.scrollTimer = setTimeout(ctx.pageListeners.flushScroll, SCROLL_IDLE_MS);
}
