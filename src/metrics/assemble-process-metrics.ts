import { collectDefaultMetrics } from "prom-client";
import type { MetricsOptions } from "../config/metrics/metrics-options.ts";
import { startEventLoopSampler } from "./event-loop/start-event-loop-sampler.ts";
import { gatewayRegistry } from "./registry/gateway-registry.ts";
import { stallSettings } from "./stall/stall-settings.ts";

let defaultsCollected = false;

/** Starts the event-loop sampler and the prom-client default process metrics (once per process). */
export function assembleProcessMetrics(options: MetricsOptions): { close(): void } {
  stallSettings.thresholdMs = options.stallThresholdMs;
  if (!defaultsCollected) {
    collectDefaultMetrics({ register: gatewayRegistry });
    defaultsCollected = true;
  }
  return startEventLoopSampler(options.eventLoopWindowMs);
}
