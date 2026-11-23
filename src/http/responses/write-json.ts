import type { HttpOptions } from "../../config/http/http-options.ts";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { API_HEADERS } from "../request/response-constants.ts";

export function responseJson(http: HttpOptions, response: ServerResponse, status: number, value: unknown): void {
  if (response.destroyed) return;
  let data: string;
  try {
    data = JSON.stringify(value) ?? "null";
  } catch {
    throw new HttpError(500, "Response could not be serialized.");
  }
  const size = Buffer.byteLength(data, "utf8");
  if (size > http.outputBytes) {
    throw new HttpError(413, "Response exceeds the output limit; no partial state was returned.");
  }
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": size, ...API_HEADERS });
  response.end(data);
}
