import type { TargetEnvironmentLease } from "../../../target-environment/connection/connection-types.ts";
import { WireError } from "../../wire/create-error.ts";

export async function executeProbe(lease: TargetEnvironmentLease, argv: readonly string[], timeoutMs: number): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  let failure: WireError | undefined;
  let retirement: Promise<void> | undefined;
  try {
    const reply = await lease.connection.request("exec", { argv, cwd: "/", env: {}, inheritEnv: true, timeoutMs }, {
      signal: lease.signal, session: await lease.connection.session(),
      onEvent(event, payload) {
        if (event.kind !== "output") return;
        bytes += payload.byteLength;
        if (bytes > 65536 || event.skipped !== undefined) {
          if (!failure) {
            failure = new WireError("TOO_LARGE", "Target inspection output exceeds 64 KiB.");
            retirement = lease.retire(failure);
            void retirement.catch(() => undefined);
          }
        } else chunks.push(Buffer.from(payload));
      },
    });
    if (failure) throw failure;
    if (reply.json.exitCode !== 0) throw new WireError("INVALID_REQUEST", "Target executable check failed.", { reason: "python-executable", exitCode: reply.json.exitCode });
    return Buffer.concat(chunks).toString("utf8").trim();
  } catch (error) {
    throw failure ?? error;
  } finally {
    await retirement;
  }
}
