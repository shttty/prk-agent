import { HttpError } from "./create-error.ts";
import { WireError } from "../../gateway/wire/create-error.ts";

/** Translate a Gateway-reported failure without rewriting its message. */
export function gatewayFailure(error: unknown, fallback: string): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof WireError) {
    const status = error.code === "NOT_FOUND" ? 404
      : error.code === "INVALID_REQUEST" || error.code === "UNSUPPORTED_METHOD" || error.code === "DUPLICATE_ID" ? 400
      : error.code === "BUSY" || error.code === "CONFLICT" || error.code === "ENVIRONMENT_REQUIRED" ? 409
      : error.code === "TOO_LARGE" ? 413
      : 503;
    return new HttpError(status, error.message, error.code, error.details);
  }
  console.error(`[${new Date().toISOString()}] ${fallback}`);
  return new HttpError(503, fallback);
}
