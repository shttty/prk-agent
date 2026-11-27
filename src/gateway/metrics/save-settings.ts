import { unlink } from "node:fs/promises";
import type { HostContext } from "../host/host-state.ts";
import type { MetricsOptions, MetricsSettings } from "../../config/metrics/metrics-options.ts";
import { readPrkConfigSnapshot } from "../../config/document/read-prk-config-snapshot.ts";
import { readPrkInstanceSnapshot } from "../../config/document/read-prk-instance-snapshot.ts";
import { parsePrkConfig } from "../../config/document/parse-prk-config.ts";
import { explainBindFailure } from "../../metrics/endpoint/explain-bind-failure.ts";
import { startMetricsListener, type MetricsListener } from "../../metrics/endpoint/start-metrics-listener.ts";
import { stageConfig } from "../instances/stage-config.ts";
import { publishConfig } from "../instances/publish-config.ts";
import { WireError } from "../wire/create-error.ts";
import type { MetricsView } from "./read-settings.ts";

/**
 * Saves `metrics.enabled`, `metrics.host` (kept when the request has none) and `metrics.port` and applies them to
 * the running listener: the old listener is closed, the new one bound, then `config.toml` replaced. If the bind or
 * the replacement fails, the old host:port is bound again and the call fails, so the file and the answer of
 * `metricsGet` stay as they were (if even that bind fails, the endpoint stays off and `error` says why).
 */
export async function metricsSet(ctx: HostContext, request: MetricsSettings): Promise<MetricsView> {
  return ctx.methods.exclusive(async () => {
    if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; metrics settings were not changed.");
    const snapshot = await readPrkConfigSnapshot(ctx.host.paths.configPath);
    const instances = await readPrkInstanceSnapshot(ctx.instances.targetConfigPath);
    const document = snapshot.document ?? {};
    const settings = { enabled: request.enabled, host: request.host ?? ctx.host.config.metrics.host, port: request.port };
    document.metrics = { ...document.metrics as Record<string, unknown> | undefined, ...settings };
    try { parsePrkConfig(document, instances.document ?? { instances: [] }); }
    catch (error) { throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid PRK configuration."); }
    const staged = await stageConfig(ctx.host.paths.configPath, document);
    const previous = ctx.metrics.listener;
    let next: MetricsListener | undefined;
    try {
      await previous?.close();
      next = await listenerFor(settings);
      publishConfig(ctx.host.paths.configPath, staged, snapshot.hash);
    } catch (error) {
      await next?.close();
      await reopen(ctx, previous);
      throw error;
    } finally {
      await unlink(staged.temporary).catch(() => {});
    }
    ctx.host.config = { ...ctx.host.config, metrics: { ...ctx.host.config.metrics, ...settings } };
    ctx.metrics.listener = next;
    ctx.metrics.failure = undefined;
    console.error(`[${new Date().toISOString()}] Gateway metrics ${next ? `on ${next.url}` : "off"}`);
    return ctx.methods.metricsGet();
  });
}

async function listenerFor({ enabled, host, port }: Pick<MetricsOptions, "enabled" | "host" | "port">): Promise<MetricsListener | undefined> {
  if (!enabled) return undefined;
  try { return await startMetricsListener(host, port); }
  catch (error) {
    const failure = `${explainBindFailure(host, port, error)} Metrics settings were not changed.`;
    console.error(`[${new Date().toISOString()}] WARN Gateway metrics: ${failure}`);
    throw new WireError("CONFLICT", failure);
  }
}

async function reopen(ctx: HostContext, previous: MetricsListener | undefined): Promise<void> {
  if (!previous) return;
  try { ctx.metrics.listener = await startMetricsListener(previous.address, previous.port); }
  catch (error) {
    ctx.metrics.listener = undefined;
    ctx.metrics.failure = explainBindFailure(previous.address, previous.port, error);
    console.error(`[${new Date().toISOString()}] ERROR Gateway metrics are off: ${ctx.metrics.failure}`);
  }
}
