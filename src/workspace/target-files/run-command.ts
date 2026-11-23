import { WireError } from "../../gateway/wire/create-error.ts";
import type { FileOperation } from "./files-types.ts";
import { request } from "./request.ts";

export async function runCommand(op: FileOperation, command: "cp" | "rmdir", paths: readonly string[]): Promise<void> {
  // Fixed script, paths only in argv. No file contents or unbounded diagnostics cross the connection.
  const script = command === "cp" ? 'exec cp -R -P -- "$1" "$2" >/dev/null 2>&1' : 'exec rmdir -- "$1" >/dev/null 2>&1';
  const { json } = await request(op, "exec", {
    argv: ["/bin/sh", "-c", script, `prk-${command}`, ...paths], cwd: "/", env: {}, inheritEnv: true,
    timeoutMs: op.options.targetConnection.requestTimeoutMs,
  });
  if (json.exitCode !== 0) throw new WireError("HOST_ERROR", `${command} failed on the target (exit ${json.exitCode}); no automatic retry.`, { reason: "failed", exitCode: json.exitCode });
}
