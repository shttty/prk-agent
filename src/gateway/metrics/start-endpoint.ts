import type { HostContext } from "../host/host-state.ts";
import { explainBindFailure } from "../../metrics/endpoint/explain-bind-failure.ts";
import { METRICS_HOST, startMetricsListener } from "../../metrics/endpoint/start-metrics-listener.ts";

/**
 * Binds the configured listener when the Gateway process starts. A port that cannot be bound turns metrics off for
 * this run instead of stopping the Gateway (metrics are a debugging aid); the reason is logged and `metricsGet`
 * reports it, so the settings page shows it until the next successful `metricsSet`.
 */
export async function startEndpoint(ctx: HostContext): Promise<void> {
  const { enabled, port } = ctx.host.config.metrics;
  if (!enabled) return;
  try {
    ctx.metrics.listener = await startMetricsListener(port);
    console.error(`[${new Date().toISOString()}] Gateway metrics on http://${METRICS_HOST}:${ctx.metrics.listener.port}/metrics`);
  } catch (error) {
    ctx.metrics.failure = explainBindFailure(port, error);
    console.error(`[${new Date().toISOString()}] ERROR Gateway metrics are off: ${ctx.metrics.failure}`);
  }
}
