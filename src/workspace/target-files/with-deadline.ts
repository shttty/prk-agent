import { WireError } from "../../gateway/wire/create-error.ts";
import type { TargetEnvironmentLease } from "../../target-environment/connection/connection-types.ts";

export async function withDeadline<T>(lease: TargetEnvironmentLease, timeoutMs: number, run: () => Promise<T>): Promise<T> {
  const timeout = new WireError("UNKNOWN", "Target file request deadline expired; effects may be unknown and will not be replayed.");
  let retirement: Promise<void> | undefined;
  const timer = setTimeout(() => {
    retirement = lease.retire(timeout);
    void retirement.catch(() => undefined);
  }, timeoutMs);
  try {
    const result = await run();
    if (retirement) throw timeout;
    if (lease.signal.aborted) throw new WireError("UNKNOWN", "Target connection was retired; file result is no longer current.");
    return result;
  } catch (error) {
    if (retirement) throw timeout;
    if (lease.signal.aborted) throw new WireError("UNKNOWN", "Target connection was retired; file operation effects may be unknown.");
    throw error;
  } finally {
    clearTimeout(timer);
    await retirement;
  }
}
