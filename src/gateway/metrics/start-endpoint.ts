import type { HostContext } from "../host/host-state.ts";
import { explainBindFailure } from "../../metrics/endpoint/explain-bind-failure.ts";
import { startMetricsListener } from "../../metrics/endpoint/start-metrics-listener.ts";

/**
 * Binds the configured listener when the Gateway process starts. An address or port that cannot be bound turns
 * metrics off for this run instead of stopping the Gateway (metrics are a debugging aid, and a VPN address may not
 * exist yet at boot); the reason is logged and `metricsGet` reports it, so the settings page shows it until the
 * next successful `metricsSet`.
 */
export async function startEndpoint(ctx: HostContext): Promise<void> {
  const { enabled, host, port } = ctx.host.config.metrics;
  if (!enabled) return;
  try {
    ctx.metrics.listener = await startMetricsListener(host, port);
    console.error(`[${new Date().toISOString()}] Gateway metrics on ${ctx.metrics.listener.url}`);
  } catch (error) {
    ctx.metrics.failure = explainBindFailure(host, port, error);
    console.error(`[${new Date().toISOString()}] ERROR Gateway metrics are off: ${ctx.metrics.failure}`);
  }
}
