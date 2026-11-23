import { sample } from "./sample.mjs";

export function stop(ctx, publishFinal = true) {
  if (ctx.stopped) return;
  ctx.stopped = true;
  clearInterval(ctx.timer);
  if (!publishFinal) return;
  try { ctx.publish(sample(ctx)); }
  catch (error) { console.error("[remote-extension host] final memory telemetry failed:", error); }
}
