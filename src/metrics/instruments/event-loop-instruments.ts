import { Counter, Gauge, Histogram } from "prom-client";
import { gatewayRegistry } from "../registry/gateway-registry.ts";

export const eventLoopDelaySeconds = new Gauge({
  name: "prk_eventloop_delay_seconds",
  help: "Event-loop delay of the last finished sample window (perf_hooks monitorEventLoopDelay, 10 ms timer), by stat p50, p99 or max.",
  labelNames: ["stat"], registers: [gatewayRegistry],
});

/** The gauge above is overwritten every window; this keeps every window's max so a short stall survives between scrapes. */
export const eventLoopWindowMaxSeconds = new Histogram({
  name: "prk_eventloop_window_max_seconds",
  help: "Maximum event-loop delay of each finished sample window.",
  buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 30], registers: [gatewayRegistry],
});

export const eventLoopUtilization = new Gauge({
  name: "prk_eventloop_utilization_ratio",
  help: "Event-loop utilization (performance.eventLoopUtilization) over the last finished sample window.",
  registers: [gatewayRegistry],
});

export const stallsTotal = new Counter({
  name: "prk_stalls_total",
  help: "Stall log lines written, by source: plugin_hook, event_loop or a serialization kind.",
  labelNames: ["kind"], registers: [gatewayRegistry],
});
