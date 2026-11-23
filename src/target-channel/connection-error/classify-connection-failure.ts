import { connectionCodes } from "./connection-protocol.ts";

export function isConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return connectionCodes[(error as NodeJS.ErrnoException).code ?? ""] === true
    || (error instanceof TypeError && /fetch failed|failed to fetch|network request failed/iu.test(error.message))
    || (error instanceof AggregateError && error.errors.some(isConnectionFailure))
    || isConnectionFailure(error.cause);
}
