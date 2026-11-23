import type { GatewayRestartOptions } from "./restart-types.ts";
import type { GatewayRestartResult } from "./restart-types.ts";
import { execFile } from "node:child_process";
import { OUTPUT_CHARS } from "./restart-constants.ts";

/**
 * Run `systemctl --user restart <unit>` from the web process. It never goes through the Gateway socket:
 * a Gateway frozen by a synchronous loop cannot answer, and systemd can still stop and start it.
 * `restart` returns once systemd's job finished; nothing here waits for the Gateway to accept connections.
 */
export function restartGatewayUnit(options: GatewayRestartOptions): Promise<GatewayRestartResult> {
  const { unit, timeoutMs } = options;
  const { promise, resolve } = Promise.withResolvers<GatewayRestartResult>();
  // `--` keeps the unit name an operand; the shell is never involved.
  execFile("systemctl", ["--user", "restart", "--", unit], { timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: 1024 * 1024, encoding: "utf8" }, (error, stdout, stderr) => {
    const output = `${stdout}${stderr}`.trim().slice(0, OUTPUT_CHARS);
    if (!error) { resolve({ status: "restarted", unit, output }); return; }
    // The deadline kills only this systemctl client; systemd may still finish the job, so the outcome is unknown.
    if (error.killed) { resolve({ status: "timeout", unit, output }); return; }
    resolve({ status: "failed", unit, exitCode: typeof error.code === "number" ? error.code : null, output: output || error.message.slice(0, OUTPUT_CHARS) });
  });
  return promise;
}
