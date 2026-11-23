export interface TargetConnectionOptions {
  readonly startTimeoutMs: number;
  readonly requestTimeoutMs: number;
}

export const DEFAULT_TARGET_CONNECTION_OPTIONS: TargetConnectionOptions = Object.freeze({
  startTimeoutMs: 15000,
  requestTimeoutMs: 10000,
});
