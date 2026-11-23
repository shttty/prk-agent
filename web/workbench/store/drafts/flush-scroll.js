import { savePresentation } from "./save-presentation.js";
/** Write the noted scroll position into the presentation. Callers run it before anything that reads or replaces the current session's presentation. */
export function flushScroll(ctx) {
  clearTimeout(ctx.scrollTimer);
  const sample = ctx.scrollSample;
  ctx.scrollSample = null;
  const position = sample?.();
  if (position) savePresentation(ctx, position);
}
