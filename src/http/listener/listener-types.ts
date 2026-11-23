import type { HttpOptions } from "../../config/http/http-options.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { ArtifactsOptions } from "../../config/artifacts/artifacts-options.ts";

export interface WebServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly http?: HttpOptions;
  readonly limits?: LimitsOptions;
  readonly home?: string;
  readonly artifacts?: ArtifactsOptions;
  /** Gateway systemd unit restarted by `POST /api/gateway/restart`; an empty `unit` means not configured. */
  readonly gatewayRestart?: { readonly unit: string; readonly timeoutMs: number };
}

export interface WebServer {
  readonly url: string;
  /** Stops HTTP observation only. Gateway-owned sessions keep running. */
  readonly close: () => Promise<void>;
  readonly closed: Promise<void>;
}
