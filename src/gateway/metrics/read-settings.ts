import type { HostContext } from "../host/host-state.ts";
import type { MetricsSettings } from "../../config/metrics/metrics-options.ts";

/** What the settings page shows: the configured switch, host and port, where the endpoint answers now, and why it does not. */
export interface MetricsView extends MetricsSettings {
  readonly host: string;
  readonly url: string | null;
  readonly error: string | null;
}

export function metricsGet(ctx: HostContext): MetricsView {
  const { enabled, host, port } = ctx.host.config.metrics;
  const { listener, failure } = ctx.metrics;
  return { enabled, host, port, url: listener?.url ?? null, error: failure ?? null };
}
