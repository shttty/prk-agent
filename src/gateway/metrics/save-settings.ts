import { unlink } from "node:fs/promises";
import type { HostContext } from "../host/host-state.ts";
import type { MetricsSettings } from "../../config/metrics/metrics-options.ts";
import { readPrkConfigSnapshot } from "../../config/document/read-prk-config-snapshot.ts";
import { readPrkInstanceSnapshot } from "../../config/document/read-prk-instance-snapshot.ts";
import { parsePrkConfig } from "../../config/document/parse-prk-config.ts";
import { explainBindFailure } from "../../metrics/endpoint/explain-bind-failure.ts";
import { METRICS_HOST, startMetricsListener, type MetricsListener } from "../../metrics/endpoint/start-metrics-listener.ts";
import { stageConfig } from "../instances/stage-config.ts";
import { publishConfig } from "../instances/publish-config.ts";
import { WireError } from "../wire/create-error.ts";
import type { MetricsView } from "./read-settings.ts";

/**
 * Saves `metrics.enabled` and `metrics.port` and applies them to the running listener. The new listener is bound
 * before the file is replaced and the old one is closed after, so a port that cannot be bound or a changed file
 * leaves the previous listener, the file and the answer of `metricsGet` as they were.
 */
export async function metricsSet(ctx: HostContext, request: MetricsSettings): Promise<MetricsView> {
  return ctx.methods.exclusive(async () => {
    const snapshot = await readPrkConfigSnapshot(ctx.host.paths.configPath);
    const instances = await readPrkInstanceSnapshot(ctx.instances.targetConfigPath);
    const document = snapshot.document ?? {};
    document.metrics = { ...document.metrics as Record<string, unknown> | undefined, enabled: request.enabled, port: request.port };
    try { parsePrkConfig(document, instances.document ?? { instances: [] }); }
    catch (error) { throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid PRK configuration."); }
    const staged = await stageConfig(ctx.host.paths.configPath, document);
    const previous = ctx.metrics.listener;
    let next = previous;
    try {
      if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; metrics settings were not changed.");
      next = await listenerFor(request, previous);
      publishConfig(ctx.host.paths.configPath, staged, snapshot.hash);
    } catch (error) {
      if (next !== previous) await next?.close();
      throw error;
    } finally {
      await unlink(staged.temporary).catch(() => {});
    }
    ctx.host.config = { ...ctx.host.config, metrics: { ...ctx.host.config.metrics, ...request } };
    ctx.metrics.listener = next;
    ctx.metrics.failure = undefined;
    if (previous !== next) await previous?.close();
    console.error(`[${new Date().toISOString()}] Gateway metrics ${next ? `on http://${METRICS_HOST}:${next.port}/metrics` : "off"}`);
    return ctx.methods.metricsGet();
  });
}

async function listenerFor(request: MetricsSettings, previous: MetricsListener | undefined): Promise<MetricsListener | undefined> {
  if (!request.enabled) return undefined;
  if (previous?.port === request.port) return previous;
  try { return await startMetricsListener(request.port); }
  catch (error) {
    const failure = `${explainBindFailure(request.port, error)} Metrics settings were not changed.`;
    console.error(`[${new Date().toISOString()}] WARN Gateway metrics: ${failure}`);
    throw new WireError("CONFLICT", failure);
  }
}
