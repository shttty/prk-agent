import type { CustomMetricsContext } from "./custom-metrics-state.ts";

export function reset(ctx: CustomMetricsContext): void { ctx.configured = ""; }
