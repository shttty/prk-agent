import { WireError } from "../../../gateway/wire/create-error.ts";
import type { WireReference } from "../../../gateway/wire/wire-types.ts";
import type { NativeTarget } from "../native-types.ts";

export function pathReference(reference: WireReference, target: NativeTarget): string {
  if (!target.target) throw new WireError("INVALID_REQUEST", "Target-file references are available only for a session with an explicit target.");
  if (reference.source !== "session-target" || reference.target !== target.target || reference.sessionId !== target.sessionId || typeof reference.path !== "string") throw new WireError("INVALID_REQUEST", "Target-file reference must match the session's exact target identity and session.");
  const normalized = reference.path;
  if (!normalized || normalized.includes("\\") || normalized.startsWith("/") || normalized.split("/").some((part) => part === "." || part === "..")) throw new WireError("INVALID_REQUEST", "Target-file reference must be a normalized relative path.");
  return normalized;
}
