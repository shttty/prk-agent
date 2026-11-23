import { WireError } from "../../../gateway/wire/create-error.ts";

export function isNativeCancellation(error: unknown, action: string): boolean {
  if (action !== "compact" && action !== "tree") return false;
  if (error instanceof WireError && error.code === "CANCELLED") return true;
  if (!(error instanceof Error)) return false;
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  return error.message === "Compaction cancelled" || error.name === "AbortError" || code === "CANCELLED" || code === "ABORT_ERR";
}
