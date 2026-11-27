import { ArtifactError } from "../../artifacts/upload-error/create-artifact-error.ts";
import { WireError } from "./create-error.ts";
import type { Response } from "./wire-types.ts";
import { SessionReadError } from "../../sessions/history/read-error.ts";
import { TargetUnreachableError } from "../../target-channel/connection-error/create-target-unreachable-error.ts";

export function failure(id: number | null, error: unknown): Response {
 const known = error instanceof WireError || error instanceof TargetUnreachableError || error instanceof ArtifactError || error instanceof SessionReadError;
 // The client only sees a generic HOST_ERROR, so the cause must reach the log.
 if (!known) console.error(`[${new Date().toISOString()}] Gateway request ${id ?? "-"} failed with an unexpected error:`, error);
 return {
  v: 1, id, ok: false, error: error instanceof WireError || error instanceof TargetUnreachableError
    ? { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) }
   : error instanceof ArtifactError ? { code: error.status === 404 ? "NOT_FOUND" : error.status === 409 ? "CONFLICT" : error.status === 413 ? "TOO_LARGE" : "INVALID_REQUEST", message: error.message }
   : error instanceof SessionReadError ? { code: "HOST_ERROR", message: error.message, details: { session: error.issue } }
   : { code: "HOST_ERROR", message: "Host operation failed; inspect current state before taking further action." }
 };
}
