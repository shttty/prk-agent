import { isConnectionFailure } from "./classify-connection-failure.ts";
import { TargetUnreachableError } from "./create-target-unreachable-error.ts";

/** Classify once at an I/O boundary; consumers only inspect the typed error. */
export function targetConnectionError(error: unknown, target: string, url?: string): TargetUnreachableError | undefined {
  if (error instanceof TargetUnreachableError) return error;
  return isConnectionFailure(error) ? new TargetUnreachableError(target, url, error) : undefined;
}
