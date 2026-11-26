import { isConnectionFailure } from "./is-connection-failure.js";

/** Text a settings page shows inline for a failed request: nothing for connection failures, the banner has them. */
export function pageErrorMessage(error) {
  return isConnectionFailure(error) ? "" : error?.message ?? "";
}
