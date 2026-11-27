import type { HostContext } from "../host/host-state.ts";
import type { MetricsSettings } from "../../config/metrics/metrics-options.ts";
import { METRICS_HOST } from "../../metrics/endpoint/start-metrics-listener.ts";

/** What the settings page shows: the configured switch and port, where the endpoint answers now, and why it does not. */
export interface MetricsView extends MetricsSettings {
  readonly url: string | null;
  readonly error: string | null;
}

export function metricsGet(ctx: HostContext): MetricsView {
  const { enabled, port } = ctx.host.config.metrics;
  const { listener, failure } = ctx.metrics;
  return { enabled, port, url: listener ? `http://${METRICS_HOST}:${listener.port}/metrics` : null, error: failure ?? null };
}
