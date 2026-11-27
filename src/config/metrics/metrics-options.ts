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

/** The two keys the settings page changes at run time. */
export type MetricsSettings = { enabled: boolean; port: number };

/** The settings page accepts unprivileged ports only; `config.toml` itself also accepts 0..1023 (0 picks a free port). */
export const METRICS_SETTINGS_PORTS = Object.freeze({ min: 1024, max: 65_535 });
