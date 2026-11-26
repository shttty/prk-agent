export interface MetricsOptions {
  /** Serve `GET /metrics` on 127.0.0.1:port from the Gateway process. Off: no listener; hook and event-loop timing still run. */
  readonly enabled: boolean;
  readonly port: number;
  /** One synchronous section (plugin hook, serialization, history load) or one event-loop window at or above this logs a stall line. */
  readonly stallThresholdMs: number;
  /** Event-loop delay histogram is read and reset once per window; the window gauges describe the last finished window. */
  readonly eventLoopWindowMs: number;
}

export const DEFAULT_METRICS_OPTIONS: MetricsOptions = Object.freeze({
  enabled: true,
  port: 9464,
  stallThresholdMs: 200,
  eventLoopWindowMs: 1000,
});
