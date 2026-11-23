import type { HttpOptions } from "../../config/http/http-options.ts";
import type { IncomingMessage } from "node:http";
import { HttpError } from "./create-error.ts";

export function contentLength(http: HttpOptions, request: IncomingMessage, maxBytes = http.bodyBytes): number | undefined {
  const value = request.headers["content-length"];
  if (value === undefined) return undefined;
  if (Array.isArray(value) || !/^\d+$/.test(value) || value.length > http.contentLengthDigits) {
    throw new HttpError(400, "Content-Length must be a non-negative decimal byte count.");
  }
  const length = Number(value);
  if (!Number.isSafeInteger(length)) throw new HttpError(400, "Content-Length is invalid.");
  if (length > maxBytes) throw new HttpError(413, "Request body exceeds the byte limit.");
  return length;
}
