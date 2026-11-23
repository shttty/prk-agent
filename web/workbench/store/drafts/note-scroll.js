const SCROLL_IDLE_MS = 200;
/** Scroll position is not render state: keep only the latest sampler and persist it once scrolling stops (see flushScroll). */
export function noteScroll(ctx, sample) {
  ctx.scrollSample = sample;
  clearTimeout(ctx.scrollTimer);
  ctx.scrollTimer = setTimeout(ctx.bound.flushScroll, SCROLL_IDLE_MS);
}
