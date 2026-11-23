

export interface GatewayRestartOptions {
  /** systemd user unit that runs the Gateway. */
  readonly unit: string;
  readonly timeoutMs: number;
}

export type GatewayRestartResult =
  | { readonly status: "restarted"; readonly unit: string; readonly output: string }
  | { readonly status: "failed"; readonly unit: string; readonly exitCode: number | null; readonly output: string }
  | { readonly status: "timeout"; readonly unit: string; readonly output: string };
