import { isPayload } from "../payload/is-payload.ts";
import type { Payload } from "../payload/is-payload.ts";

/** Projection exposes raw code or JSON text in `argsText`; structured bodies parse the latter here. */
export function parseToolArgs(code: string): Payload | null {
  try {
    // Boundary: the argument text came off the wire.
    const value: unknown = JSON.parse(code);
    return isPayload(value) ? value : null;
  } catch {
    return null;
  }
}
