import { isRecord } from "../../payloads/is-record.ts";

/** A failed API call: `status` is the HTTP status (0 when the service was unreachable); `code` and `details` come from the error body. */
export class RequestError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, status: number, body?: unknown, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
    this.code = isRecord(body) && typeof body.code === "string" ? body.code : undefined;
    this.details = isRecord(body) && isRecord(body.details) ? body.details : undefined;
  }
}
