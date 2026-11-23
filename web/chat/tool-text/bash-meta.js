
/** Timeout configuration for a bash call; empty when none was supplied. */
export function bashMeta(args) {
  const timeout = Number(args?.timeout);
  return timeout > 0 ? `timeout ${timeout}s` : "";
}
