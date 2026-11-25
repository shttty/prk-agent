export interface HttpOptions {
  readonly host: string;
  readonly port: number;
  readonly connectionsMax: number;
  readonly streamsMax: number;
  readonly requestTimeoutMs: number;
  readonly uploadIdleTimeoutMs: number;
  readonly headersTimeoutMs: number;
  readonly heartbeatMs: number;
  readonly streamTimeoutMs: number;
  readonly bodyBytes: number;
  readonly outputBytes: number;
  readonly contentLengthDigits: number;
  readonly extensionUiRenderIntervalMs: number;
  readonly terminalBusyRetriesMax: number;
  readonly terminalBusyBackoffMs: number;
  readonly terminalBusyBackoffMaxMs: number;
}
export const DEFAULT_HTTP_OPTIONS: HttpOptions = Object.freeze({
  host: "127.0.0.1",
  port: 8787,
  connectionsMax: 64,
  streamsMax: 24,
  requestTimeoutMs: 120_000,
  uploadIdleTimeoutMs: 60_000,
  headersTimeoutMs: 15_000,
  heartbeatMs: 15_000,
  streamTimeoutMs: 0,
  bodyBytes: 1024 * 1024,
  outputBytes: 8 * 1024 * 1024,
  contentLengthDigits: 15,
  extensionUiRenderIntervalMs: 60,
  terminalBusyRetriesMax: 40,
  terminalBusyBackoffMs: 200,
  terminalBusyBackoffMaxMs: 2000,
});
