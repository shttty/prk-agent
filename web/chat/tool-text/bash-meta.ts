import type { Payload } from "../payload/is-payload.ts";

/** Timeout configuration for a bash call; empty when none was supplied. */
export function bashMeta(args: Payload | null | undefined) {
  const timeout = Number(args?.timeout);
  return timeout > 0 ? `timeout ${timeout}s` : "";
}
