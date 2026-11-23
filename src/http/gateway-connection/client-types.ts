import type { DownloadMetadata } from "../../workspace/target-files/files-types.ts";
import type { Method } from "../../gateway/wire/wire-types.ts";
import type { RecoveryMode } from "../../gateway/wire/wire-types.ts";
import type { GatewayOptions } from "../../config/gateway/gateway-options.ts";
import type { HttpOptions } from "../../config/http/http-options.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";

export type CodeModeMethod = Extract<Method, `kernel${string}` | `tools${string}` | `skills${string}` | `memory${string}` | `pluginConfig${string}` | `monitor${string}` | `themes${string}`>;

/** Sink for one browser's live observation of one Gateway-owned session. */
export interface WebObserverSink {
  snapshot(value: unknown): void;
  event(value: unknown): void;
  /** Observation ended; the session itself is unaffected. */
  end(reason: string): void;
}

/** Sink for one browser terminal socket. `failure` reports an input/resize the Gateway did not accept (nothing is resent). */
export interface WebTerminalSink extends WebObserverSink {
  failure(error: unknown): void;
}

/** Ordered, pipelined input path of one open terminal. */
export interface WebTerminalSession {
  input(data: string): void;
  resize(rows: number, cols: number): void;
  close(): void;
}

/**
 * The only Gateway capability surface the web adapter may use.
 *
 * Requests use the shared control connection; observations and terminals own
 * their stream connections. There is no local SDK or kernel handle: Gateway
 * unavailability is reported instead of starting a substitute host.
 */
export interface WebGatewayClient {
  available(): boolean;
  call(method: Method, params: Record<string, unknown>): Promise<unknown>;
  downloadFile(params: Record<string, unknown>, signal: AbortSignal, sink: WebDownloadSink): Promise<void>;
  observe(sessionId: string, sink: WebObserverSink): Promise<() => void>;
  observeSessions(sink: WebObserverSink): Promise<() => void>;
  terminalSession(sessionId: string, name: string, sink: WebTerminalSink, generation?: string): Promise<WebTerminalSession>;
  close(): Promise<void>;
}

export interface WebDownloadSink {
  open(metadata: DownloadMetadata): void;
  write(chunk: Buffer): Promise<void>;
}

export interface WebRecoverSessionRequest {
  readonly mode: RecoveryMode;
  readonly target?: string;
  readonly cwd?: string;
}

export interface WebGatewayOptions {
  /** Private Unix socket published by the Gateway. */
  readonly socket: string;
  readonly gateway?: GatewayOptions;
  readonly http?: HttpOptions;
  readonly limits?: LimitsOptions;
}

export interface WebGatewayConnection extends WebGatewayClient {
  /** Owned stream connections currently established. */
  readonly streamCount: () => number;
}
