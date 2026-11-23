import { join } from "node:path";
import { tmpdir } from "node:os";

export interface GatewayOptions {
  readonly socketPath: string;
  readonly connectionsMax: number;
  readonly pendingMax: number;
  readonly connectTimeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly socketCloseGraceMs: number;
  /** systemd user unit the web process restarts for the Gateway; empty means not configured. */
  readonly systemdUnit: string;
  /** Deadline of the `systemctl --user restart` call made by the web process. */
  readonly restartTimeoutMs: number;
}
export const DEFAULT_GATEWAY_OPTIONS: GatewayOptions = Object.freeze({
  socketPath: join(tmpdir(), `pi-gateway-${process.geteuid?.()}`, "gateway.sock"),
  connectionsMax: 64,
  pendingMax: 32,
  connectTimeoutMs: 30_000,
  requestTimeoutMs: 30_000,
  socketCloseGraceMs: 1000,
  systemdUnit: "",
  restartTimeoutMs: 120_000,
});
