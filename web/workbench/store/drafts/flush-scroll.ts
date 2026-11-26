import type { StoreContext } from "../store-context-types.ts";
import { savePresentation } from "./save-presentation.ts";

/** Write the noted scroll position into the presentation. Callers run it before anything that reads or replaces the current session's presentation. */
export function flushScroll(ctx: StoreContext) {
  clearTimeout(ctx.scrollTimer);
  const sample = ctx.scrollSample;
  ctx.scrollSample = null;
  const position = sample?.();
  if (position) savePresentation(ctx, position);
}
