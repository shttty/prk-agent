import type { ModelTerminalsContext } from "../terminal-state.ts";
import { milliseconds } from "../timing/parse-duration.ts";

export function yieldTime(ctx: ModelTerminalsContext, seconds?: number): number { return milliseconds(seconds, ctx.options.yieldMs, ctx.options.maxYieldMs, "yield_s"); }
