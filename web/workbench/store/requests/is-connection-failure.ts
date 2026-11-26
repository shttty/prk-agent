import { RequestError } from "./request-error.ts";

/**
 * A request that failed because the Web service or the Gateway behind it is not reachable (network failure, status 0,
 * or 503: Gateway unavailable or the service shutting down), as opposed to the page's own refusals (400/404/409…).
 * The connection banner reports these; pages wait for the link instead of repeating them.
 */
export function isConnectionFailure(error: unknown): boolean {
  return error instanceof RequestError && (error.status === 0 || error.status === 503);
}
