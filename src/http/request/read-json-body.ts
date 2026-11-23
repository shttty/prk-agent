import type { HttpOptions } from "../../config/http/http-options.ts";
import type { IncomingMessage } from "node:http";
import { JSON_CONTENT_TYPE } from "./request-constants.ts";
import { HttpError } from "./create-error.ts";
import { object } from "../../gateway/wire/is-record.ts";
import { readRequestBody } from "./read-request-body.ts";

export async function readJsonBody(http: HttpOptions, request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== JSON_CONTENT_TYPE) {
    throw new HttpError(415, "Request content type must be application/json.");
  }
  const bytes = await readRequestBody(http, request);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "Request body is not valid JSON.");
  }
  if (!object(parsed)) throw new HttpError(400, "Request body must be a JSON object.");
  return parsed;
}
