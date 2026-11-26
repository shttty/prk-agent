import { isConnectionFailure } from "./is-connection-failure.ts";

/** Text a settings page shows inline for a failed request: nothing for connection failures, the banner has them. */
export function pageErrorMessage(error: unknown): string {
  return isConnectionFailure(error) || !(error instanceof Error) ? "" : error.message;
}
