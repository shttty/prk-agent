import type { ArtifactsOptions } from "../../config/artifacts/artifacts-options.ts";
import type { GatewayOptions } from "../../config/gateway/gateway-options.ts";
import type { HttpOptions } from "../../config/http/http-options.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";

export interface WebApplicationOptions {
  /** Private Unix socket of the Gateway that owns the sessions. */
  readonly socket: string;
  readonly home?: string;
  readonly artifacts?: ArtifactsOptions;
  readonly host?: string;
  readonly port?: number;
  readonly gateway?: GatewayOptions;
  readonly http?: HttpOptions;
  readonly limits?: LimitsOptions;
}
