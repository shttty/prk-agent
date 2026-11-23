export interface MonitorOptions {
  /** Master switch: off means no collector is ever started and cards show no monitor data. */
  readonly enabled: boolean;
  /** Collection period for every awake session's machine (card closed). */
  readonly slowIntervalMs: number;
  /** Collection period for a machine while a session's card is open. */
  readonly fastIntervalMs: number;
  /** A card-open heartbeat keeps the fast period this long; a vanished browser falls back to slow. */
  readonly focusLeaseMs: number;
  /** In-memory per-instance chart window; no collection is started just to fill it. */
  readonly historyWindowMs: number;
  /** Per custom command deadline and combined stdout/stderr byte limit. */
  readonly customTimeoutMs: number;
  readonly customMaxOutputBytes: number;
  /** Kernel memory (workingSet / memoryMax) at or above this percent raises the alert dot. */
  readonly memoryAlertPercent: number;
  /** Coalesce window for "tool finished" git refreshes. */
  readonly refreshDebounceMs: number;
}

export const DEFAULT_MONITOR_OPTIONS: MonitorOptions = Object.freeze({
  enabled: true,
  slowIntervalMs: 30_000,
  fastIntervalMs: 5_000,
  focusLeaseMs: 30_000,
  historyWindowMs: 15 * 60_000,
  customTimeoutMs: 5_000,
  customMaxOutputBytes: 65_536,
  memoryAlertPercent: 90,
  refreshDebounceMs: 300,
});
